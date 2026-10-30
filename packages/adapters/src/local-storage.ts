import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Storage } from "./interfaces.js";

/** Disk storage for development. Production uses Cloud Storage. */
export class LocalStorage implements Storage {
  private readonly root: string;

  constructor(
    root: string,
    private readonly baseUrl = "/api/files",
  ) {
    this.root = resolve(root);
  }

  private resolvePath(relativePath: string): string {
    const absolute = resolve(this.root, relativePath);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error("Path outside the storage root");
    }
    return absolute;
  }

  async put(path: string, content: Buffer) {
    const target = this.resolvePath(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  get(path: string) {
    return readFile(this.resolvePath(path));
  }

  async exists(path: string) {
    try {
      await stat(this.resolvePath(path));
      return true;
    } catch {
      return false;
    }
  }

  delete(path: string) {
    return rm(this.resolvePath(path), { force: true });
  }

  async temporaryUrl(path: string) {
    // No signing locally: the API serves the file after checking the session.
    return `${this.baseUrl}/${encodeURI(path)}`;
  }
}
