import { ACMClient, DescribeCertificateCommand, ListCertificatesCommand } from '@aws-sdk/client-acm';
import {
    CacheBehavior,
    CloudFrontClient,
    CreateDistributionCommand,
    DefaultCacheBehavior,
    DistributionConfig,
    ListCachePoliciesCommand,
    ListOriginRequestPoliciesCommand,
    ListResponseHeadersPoliciesCommand,
    Origin,
} from '@aws-sdk/client-cloudfront';
import 'dotenv/config';
// Add Node utils for directory scanning and dynamic import resolution
import { fromEnv } from '@aws-sdk/credential-providers';
import { caching } from '../../caching.config';

export declare interface IBehavior {
    precedence: number;
    pathPattern: string;
    cache: boolean;
}

// Helpers to resolve managed policy IDs by name (case-insensitive, ignore non-alphanumerics)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function findManagedCachePolicyId(client: CloudFrontClient, name: string): Promise<string> {
    const res = await client.send(new ListCachePoliciesCommand({ Type: 'managed' }));
    const target = normalize(name);
    const match = res.CachePolicyList?.Items?.find(
        i => i.CachePolicy?.CachePolicyConfig?.Name && normalize(i.CachePolicy.CachePolicyConfig.Name) === target
    )?.CachePolicy?.Id;
    if (!match) throw new Error(`Managed cache policy not found: ${name}`);
    return match;
}

async function findManagedOriginRequestPolicyId(client: CloudFrontClient, name: string): Promise<string> {
    const res = await client.send(new ListOriginRequestPoliciesCommand({ Type: 'managed' }));
    const target = normalize(name);
    const match = res.OriginRequestPolicyList?.Items?.find(
        i => i.OriginRequestPolicy?.OriginRequestPolicyConfig?.Name && normalize(i.OriginRequestPolicy.OriginRequestPolicyConfig.Name) === target
    )?.OriginRequestPolicy?.Id;
    if (!match) throw new Error(`Managed origin request policy not found: ${name}`);
    return match;
}

async function findManagedResponseHeadersPolicyId(client: CloudFrontClient, name: string): Promise<string> {
    const res = await client.send(new ListResponseHeadersPoliciesCommand({ Type: 'managed' }));
    const target = normalize(name);
    const match = res.ResponseHeadersPolicyList?.Items?.find(
        i => i.ResponseHeadersPolicy?.ResponseHeadersPolicyConfig?.Name && normalize(i.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name) === target
    )?.ResponseHeadersPolicy?.Id;
    if (!match) throw new Error(`Managed response headers policy not found: ${name}`);
    return match;
}

async function findCertificateArnByName(certificateName: string): Promise<string | undefined> {
    if (!certificateName) return undefined;

    const acm = new ACMClient({ region: 'us-east-1', credentials: fromEnv() });
    const target = certificateName.toLowerCase();

    const matches = (host: string | undefined, pattern: string | undefined) => {
        if (!host || !pattern) return false;
        const h = host.toLowerCase();
        const p = pattern.toLowerCase();
        if (h === p) return true;
        if (p.startsWith('*.')) {
            const base = p.slice(2);
            return h === base || h.endsWith(`.${base}`);
        }
        return false;
    };

    // Pass 1: try to match summaries by DomainName to avoid extra API calls
    let nextToken: string | undefined = undefined;
    const candidateArns: string[] = [];
    do {
        const res:any = await acm.send(new ListCertificatesCommand({ NextToken: nextToken }));
        for (const s of res.CertificateSummaryList ?? []) {
            const arn = s.CertificateArn;
            const domain = s.DomainName;
            if (arn) candidateArns.push(arn);
            if (matches(target, domain) && arn) {
                return arn;
            }
        }
        nextToken = res.NextToken;
    } while (nextToken);

    // Pass 2: describe each candidate to check SANs and prefer ISSUED certs
    let fallbackArn: string | undefined = undefined;
    for (const arn of candidateArns) {
        try {
            const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: arn }));
            const cert = res.Certificate;
            if (!cert) continue;

            const names = new Set<string>();
            if (cert.DomainName) names.add(cert.DomainName);
            for (const san of cert.SubjectAlternativeNames ?? []) {
                if (san) names.add(san);
            }

            let anyMatch = false;
            for (const n of names) {
                if (matches(target, n)) {
                    anyMatch = true;
                    break;
                }
            }

            if (anyMatch) {
                if (cert.Status === 'ISSUED') {
                    return arn; // prefer valid/issued certificate
                }
                // remember a non-issued match as fallback
                fallbackArn = fallbackArn ?? arn;
            }
        } catch {
            // ignore describe failures and continue
        }
    }

    return fallbackArn;
}

const createCloudFrontDistribution = async (): Promise<string> => {
    const cloudFront = new CloudFrontClient({ region: 'us-east-1', credentials: fromEnv() });

    const getEnv = (k: string) => process.env[k]?.trim() || undefined;
    const originDomainName =
        getEnv('ORIGIN_DOMAIN_NAME') ||
        getEnv('CF_ORIGIN_DOMAIN_NAME');
    if (!originDomainName) {
        throw new Error('Missing ORIGIN_DOMAIN_NAME in environment');
    }
    const alternateDomainNames =
        getEnv('ALTERNATE_DOMAIN_NAMES')
            ?.split(',')
            .map(s => s.trim())
            .filter(Boolean) ?? [];
    const certificateName = getEnv('CERTIFICATE_NAME');

    // Resolve required managed policy IDs
    const [
        responseHeadersPolicyId,
        cachePolicyDisabledId,
        originRequestAllExceptHostId,
        cachePolicyOptimizedId,
    ] = await Promise.all([
        // "Managed CORS with Preflight" (spaces or hyphens handled by normalize)
        findManagedResponseHeadersPolicyId(cloudFront, 'Managed CORS with Preflight'),
        findManagedCachePolicyId(cloudFront, 'Managed-CachingDisabled'),
        findManagedOriginRequestPolicyId(cloudFront, 'Managed-AllViewerExceptHostHeader'),
        // Used for cached endpoints
        findManagedCachePolicyId(cloudFront, 'Managed-CachingOptimized'), // TODO: Replace with custom policy - CacheingWithQueryStrings
    ]);

    const origins: Origin[] = [
        {
            Id: 'LambdaOrigin',
            DomainName: originDomainName,
            CustomOriginConfig: {
                OriginProtocolPolicy: 'https-only',
                HTTPPort: 80,
                HTTPSPort: 443,
            },
        },
    ];

    const defaultCacheBehavior: DefaultCacheBehavior = {
        TargetOriginId: 'LambdaOrigin',
        ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
                Quantity: 2,
                Items: ['GET', 'HEAD'],
            },
        },
        // Default to uncached for unspecified endpoints
        CachePolicyId: cachePolicyDisabledId,
        OriginRequestPolicyId: originRequestAllExceptHostId,
        ResponseHeadersPolicyId: responseHeadersPolicyId,
    };

    const cacheBehaviors: CacheBehavior[] = (caching).map(behavior => ({
        PathPattern: behavior.pathPattern,
        TargetOriginId: 'LambdaOrigin',
        ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD', 'OPTIONS'],
            CachedMethods: {
                Quantity: 2,
                Items: ['GET', 'HEAD', 'OPTIONS'],
            },
        },
        ResponseHeadersPolicyId: responseHeadersPolicyId,
        CachePolicyId: behavior.cache ? cachePolicyOptimizedId : cachePolicyDisabledId,
        OriginRequestPolicyId: originRequestAllExceptHostId,
    }));

    const distributionConfig: DistributionConfig = {
        CallerReference: `${Date.now()}`,
        Origins: {
            Quantity: origins.length,
            Items: origins,
        },
        DefaultCacheBehavior: defaultCacheBehavior,
        CacheBehaviors: {
            Quantity: cacheBehaviors.length,
            Items: cacheBehaviors,
        },
        Enabled: true,
        Comment: 'Created by createCloudFrontDistribution function',
    };

    if (alternateDomainNames.length > 0) {
        distributionConfig.Aliases = {
            Quantity: alternateDomainNames.length,
            Items: alternateDomainNames,
        };
    }

    // Resolve and apply ACM certificate by name (CloudFront requires us-east-1)
    let certificateArn: string | undefined;
    if (certificateName) {
        certificateArn = await findCertificateArnByName(certificateName);
    }
    if (certificateArn) {
        distributionConfig.ViewerCertificate = {
            ACMCertificateArn: certificateArn,
            SSLSupportMethod: 'sni-only',
            MinimumProtocolVersion: 'TLSv1.2_2019',
        };
    }

    const command = new CreateDistributionCommand({ DistributionConfig: distributionConfig });

    const response = await cloudFront.send(command);

    if (!response.Distribution || !response.Distribution.DomainName) {
        throw new Error('Failed to create CloudFront distribution');
    }

    return response.Distribution.DomainName;
};

createCloudFrontDistribution();