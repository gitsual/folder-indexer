import { App, Plugin, Notice, TFile } from 'obsidian';

interface IndexResult {
    created: boolean;
    path: string;
    content: string[];
}

interface VaultIndexResult {
    createdFiles: Array<{
        path: string;
        content: string[];
    }>;
    updatedFiles: Array<{
        path: string;
        addedContent: string[];
    }>;
    totalDirectories: number;
}

export default class FolderIndexerPlugin extends Plugin {
    async onload() {
        console.log('Cargando FolderIndexer plugin');

        this.addRibbonIcon('list-ordered', 'Indexar Carpetas', async () => {
            const result = await this.indexVault();
            new Notice(`Actualización completada: ${result.totalDirectories} directorios procesados`);
            this.showResultModal(result);
        });
    }

    async onunload() {
        console.log('Descargando FolderIndexer plugin');
    }

    private async getMarkdownFiles(dir: string): Promise<TFile[]> {
        const files = this.app.vault.getMarkdownFiles();
        return files.filter(file => file.parent?.path === dir);
    }

    private async processDirectory(dirPath: string): Promise<IndexResult> {
        const dirName = dirPath.split('/').pop() || dirPath;
        const indexPath = `${dirPath}/${dirName}.md`;
        const files = await this.getMarkdownFiles(dirPath);
        const references = files
            .filter(file => file.path !== indexPath)
            .map(file => `[[${file.basename}]]`);

        const indexFile = this.app.vault.getAbstractFileByPath(indexPath);

        if (!indexFile) {
            await this.app.vault.create(indexPath, references.join('\n'));
            return {
                created: true,
                path: indexPath,
                content: references
            };
        } else {
            const content = await this.app.vault.read(indexFile as TFile);
            const existingRefs = new Set(
                content.match(/\[\[.*?\]\]/g)?.map(ref => ref) || []
            );

            const newRefs = references.filter(ref => !existingRefs.has(ref));

            if (newRefs.length > 0) {
                await this.app.vault.modify(
                    indexFile as TFile,
                    content + '\n' + newRefs.join('\n')
                );
                return {
                    created: false,
                    path: indexPath,
                    content: newRefs
                };
            }
        }

        return {
            created: false,
            path: indexPath,
            content: []
        };
    }

    private async indexVault(): Promise<VaultIndexResult> {
        const result: VaultIndexResult = {
            createdFiles: [],
            updatedFiles: [],
            totalDirectories: 0
        };

        const files = this.app.vault.getAllLoadedFiles();
        const directories = new Set(
            files
                .filter(f => f.parent)
                .map(f => f.parent?.path)
                .filter(p => p !== '/')
        );

        for (const dir of directories) {
            if (dir) {
                const processResult = await this.processDirectory(dir);
                if (processResult.content.length > 0) {
                    if (processResult.created) {
                        result.createdFiles.push({
                            path: processResult.path,
                            content: processResult.content
                        });
                    } else {
                        result.updatedFiles.push({
                            path: processResult.path,
                            addedContent: processResult.content
                        });
                    }
                }
                result.totalDirectories++;
            }
        }

        return result;
    }

    private showResultModal(result: VaultIndexResult) {
        new Notice(`Archivos creados: ${result.createdFiles.length}\nArchivos actualizados: ${result.updatedFiles.length}`);
    }
}
