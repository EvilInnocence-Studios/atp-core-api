import { database } from './database';
import { IMigration } from './dbMigrations';
import { migrations } from '../../migrations';

export interface MigrationStatus {
    module: string;
    currentVersion: number;
    latestVersion: number;
    pendingCount: number;
}

export class MigrationRunner {
    private db = database();

    async ensureTrackingTable() {
        const hasTable = await this.db.schema.hasTable('_migrations');
        if (!hasTable) {
            await this.db.schema.createTable('_migrations', (table) => {
                table.string('module').notNullable();
                table.integer('version').notNullable();
                table.string('name').notNullable();
                table.timestamp('applied_at').defaultTo(this.db.fn.now());
                table.primary(['module', 'version']);
            });
        }
    }

    async getStatus(): Promise<MigrationStatus[]> {
        await this.ensureTrackingTable();

        const applied = await this.db('_migrations').select('module', 'version');
        const statusMap = new Map<string, MigrationStatus>();

        migrations.forEach((m) => {
            if (!statusMap.has(m.module)) {
                statusMap.set(m.module, {
                    module: m.module,
                    currentVersion: -1,
                    latestVersion: -1,
                    pendingCount: 0
                });
            }

            const status = statusMap.get(m.module)!;
            if (m.version > status.latestVersion) {
                status.latestVersion = m.version;
            }

            const isApplied = applied.some(a => a.module === m.module && a.version === m.version);
            if (isApplied) {
                if (m.version > status.currentVersion) {
                    status.currentVersion = m.version;
                }
            } else {
                status.pendingCount++;
            }
        });

        return Array.from(statusMap.values());
    }

    async runPending() {
        await this.ensureTrackingTable();
        const applied = await this.db('_migrations').select('module', 'version');
        
        // Sort migrations by version and module (ideally module dependencies should be considered)
        const pending = migrations.filter(m => 
            !applied.some(a => a.module === m.module && a.version === m.version)
        ).sort((a, b) => {
            if (a.module !== b.module) return a.module.localeCompare(b.module);
            return a.version - b.version;
        });

        for (const m of pending) {
            console.log(`Applying migration: ${m.module} v${m.version} - ${m.name}`);
            await m.up();
            await m.initData();
            
            await this.db('_migrations').insert({
                module: m.module,
                version: m.version,
                name: m.name
            });
        }
        
        return pending.length;
    }
}
