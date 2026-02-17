import fs from 'fs';
import { Index } from 'ts-functional/dist/types';

export const loadEnv = (envFile:string):Index<string> => fs.readFileSync(envFile, 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '' && !line.startsWith('#'))
    .reduce((acc, line) => {
        const [key, value] = line.split('=');
        acc[key.trim()] = value.trim();
        return acc;
    }, {} as Index<string>);
