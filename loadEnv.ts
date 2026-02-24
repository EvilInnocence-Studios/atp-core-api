import fs from 'fs';
import { Index } from 'ts-functional/dist/types';

export const loadEnv = (envFile:string):Index<string> => fs.readFileSync(envFile, 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '' && !line.startsWith('#'))
    .reduce((acc, line) => {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) return acc;
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1).trim();

        if(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_DEFAULT_REGION'].includes(key)) {
            return acc;
        }

        // Strip quotes
        value = value.replace(/^(['"])(.*)\1$/, '$2');

        acc[key] = value;
        return acc;
    }, {} as Index<string>);
