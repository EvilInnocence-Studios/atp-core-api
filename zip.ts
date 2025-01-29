import archiver from 'archiver';
import fs from 'fs';

export const zipDirectory = async (source: string, out: string): Promise<any> => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    console.log("Zipping up app");
    return new Promise((resolve, reject) => {
        archive
            .glob('**/*', { cwd: source })
            // .glob('node_modules/**/*', { cwd: path.resolve(__dirname) }) // Include node_modules
            .on('error', error => reject(new Error(`Error zipping directory: ${error.message}`)))
            .pipe(stream);

        stream.on('close', () => resolve(stream));
        archive.finalize();
    }).then(stream => {
        console.log(`App zipped successfully to ${out}`);
        return stream;
    });
}
