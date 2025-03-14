export const profile = (name: string, fn: Function) => 
    async (...args: any[]) => {
        const start = performance.now();
        const result = await fn(...args);
        const end = performance.now();
        console.log(`${name}: ${end - start}ms`);
        return result;
    };
