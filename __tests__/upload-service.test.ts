import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";

/**
 * Tests for the VPS upload service.
 *
 * These tests mock the filesystem and sharp to avoid actual I/O.
 * They validate the service's security, filename generation, path
 * traversal protection, deletion safety, and URL generation.
 */

// ---- Mocks ----------------------------------------------------------------

// Mock node:fs/promises
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockStat = vi.fn().mockResolvedValue({ isFile: () => true });
const mockWriteSSH = vi.fn().mockResolvedValue(undefined);
const mockDeleteSSH = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/services/upload-ssh.storage", () => ({
  usesSSHUploadStorage: () => process.env.UPLOAD_STORAGE === "ssh",
  writeUploadFileViaSSH: (...args: unknown[]) => mockWriteSSH(...args),
  deleteUploadFileViaSSH: (...args: unknown[]) => mockDeleteSSH(...args),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  stat: (...args: unknown[]) => mockStat(...args),
}));

// Mock sharp
const mockToBuffer = vi.fn().mockResolvedValue({
  data: Buffer.from("fake-webp-data"),
  info: { width: 800, height: 600 },
});

const mockSharpInstance = {
  metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
  resize: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: mockToBuffer,
};

vi.mock("sharp", () => ({
  default: () => mockSharpInstance,
}));

// ---- Helpers ---------------------------------------------------------------

/** JPEG file magic bytes */
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** PNG file magic bytes */
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);



function makeImageFile(
  magic: Buffer,
  name: string,
  type: string,
  sizeBytes?: number,
): File {
  const size = sizeBytes ?? magic.length + 100;
  const padding = Buffer.alloc(Math.max(0, size - magic.length));
  const fullBuffer = Buffer.concat([magic, padding]);
  const blob = new Blob([fullBuffer], { type });
  return new File([blob], name, { type });
}

function makeNonImageFile(): File {
  const data = Buffer.from("not an image at all");
  const blob = new Blob([data], { type: "text/plain" });
  return new File([blob], "readme.txt", { type: "text/plain" });
}

// ---- Test suite ------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv("UPLOAD_STORAGE", undefined);
  mockWriteSSH.mockReset().mockResolvedValue(undefined);
  mockDeleteSSH.mockReset().mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("upload.service", () => {
  const UPLOAD_DIR = "/var/www/uploads/bangbuy";
  const UPLOAD_PUBLIC_URL = "https://example.com/uploads";

  beforeEach(() => {
    process.env.UPLOAD_DIR = UPLOAD_DIR;
    process.env.UPLOAD_PUBLIC_URL = UPLOAD_PUBLIC_URL;
    process.env.MAX_UPLOAD_SIZE_MB = "5";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_URL;
    delete process.env.MAX_UPLOAD_SIZE_MB;
  });

  // We dynamically import to pick up the env vars set in beforeEach
  async function importService() {
    // Clear the module cache so env changes take effect
    vi.resetModules();
    return import("@/lib/services/upload.service");
  }

  // -- Valid uploads ---------------------------------------------------------

  it("should upload a valid JPEG file and return a public URL", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "photo.jpg", "image/jpeg");

    const result = await uploadImageToVPS(file, "products");

    expect(result.url).toMatch(
      /^https:\/\/example\.com\/uploads\/products\/.+\.webp$/,
    );
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.size).toBeGreaterThan(0);
    expect(result.deleteUrl).toBe("");

    // Verify mkdir was called with the correct directory
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining("products"),
      { recursive: true },
    );

    // Verify writeFile was called
    expect(mockWriteFile).toHaveBeenCalledOnce();
  });

  it("should upload a valid PNG file", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(PNG_MAGIC, "icon.png", "image/png");

    const result = await uploadImageToVPS(file, "categories");

    expect(result.url).toContain("/categories/");
    expect(result.url).toMatch(/\.webp$/);
  });

  it("uploads optimized images to the VPS instead of creating local directories in SSH mode", async () => {
    vi.stubEnv("UPLOAD_STORAGE", "ssh");
    const { uploadImageToVPS } = await importService();
    const result = await uploadImageToVPS(makeImageFile(JPEG_MAGIC, "photo.jpg", "image/jpeg"), "products");

    expect(mockWriteSSH).toHaveBeenCalledWith(
      UPLOAD_DIR,
      "products",
      expect.stringMatching(/^[a-z0-9]+-[a-f0-9]{24}\.webp$/),
      Buffer.from("fake-webp-data"),
    );
    expect(result.url).toBe(`${UPLOAD_PUBLIC_URL}/products/${mockWriteSSH.mock.calls[0][2]}`);
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("preserves SSH storage errors instead of falling back to the local filesystem", async () => {
    vi.stubEnv("UPLOAD_STORAGE", "ssh");
    const { uploadImageToVPS } = await importService();
    const { ServiceError } = await import("@/lib/services/service-error");
    mockWriteSSH.mockRejectedValueOnce(new ServiceError(500, "Upload storage is unavailable. Please try again later."));

    await expect(uploadImageToVPS(makeImageFile(JPEG_MAGIC, "photo.jpg", "image/jpeg")))
      .rejects.toMatchObject({ status: 500, message: "Upload storage is unavailable. Please try again later." });
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("should default to 'other' category when none specified", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    const result = await uploadImageToVPS(file);

    expect(result.url).toContain("/other/");
  });

  // -- Unique filenames ------------------------------------------------------

  it("should generate unique filenames for consecutive uploads", async () => {
    const { uploadImageToVPS } = await importService();
    const file1 = makeImageFile(JPEG_MAGIC, "same.jpg", "image/jpeg");
    const file2 = makeImageFile(JPEG_MAGIC, "same.jpg", "image/jpeg");

    const result1 = await uploadImageToVPS(file1, "products");
    const result2 = await uploadImageToVPS(file2, "products");

    // URLs should be different even with the same original filename
    expect(result1.url).not.toBe(result2.url);
  });

  // -- Invalid MIME/type validation ------------------------------------------

  it("should reject non-image MIME types", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeNonImageFile();

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "Only image files can be uploaded",
    );
  });

  it("should reject files whose magic bytes don't match any image format", async () => {
    const { uploadImageToVPS } = await importService();
    // File claims to be JPEG but has wrong magic bytes
    const badMagic = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const file = makeImageFile(badMagic, "fake.jpg", "image/jpeg");

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "does not appear to be a valid image",
    );
  });

  // -- Oversized file --------------------------------------------------------

  it("should reject files exceeding the size limit", async () => {
    const { uploadImageToVPS } = await importService();
    // Create a file > 5 MB
    const oversized = makeImageFile(
      JPEG_MAGIC,
      "huge.jpg",
      "image/jpeg",
      6 * 1024 * 1024,
    );

    await expect(uploadImageToVPS(oversized)).rejects.toThrow(
      "exceeds the 5MB upload limit",
    );
  });

  // -- Empty file ------------------------------------------------------------

  it("should reject empty files", async () => {
    const { uploadImageToVPS } = await importService();
    const blob = new Blob([], { type: "image/jpeg" });
    const file = new File([blob], "empty.jpg", { type: "image/jpeg" });

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "uploaded file is empty",
    );
  });

  // -- Invalid category (path traversal) -------------------------------------

  it("should reject path-traversal category values", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    await expect(
      // @ts-expect-error testing invalid category
      uploadImageToVPS(file, "../../../etc"),
    ).rejects.toThrow("Invalid upload category");
  });

  // -- Public URL generation -------------------------------------------------

  it("should generate correct public URLs", async () => {
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    const result = await uploadImageToVPS(file, "users");

    expect(result.url).toMatch(
      /^https:\/\/example\.com\/uploads\/users\/[a-z0-9]+-[a-f0-9]+\.webp$/,
    );
    expect(result.displayUrl).toBe(result.url);
    expect(result.thumbUrl).toBe(result.url);
  });

  // -- Missing configuration ------------------------------------------------

  it("should throw when UPLOAD_DIR is not configured", async () => {
    delete process.env.UPLOAD_DIR;
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "upload storage is not configured",
    );
  });

  it("should throw when UPLOAD_PUBLIC_URL is not configured", async () => {
    delete process.env.UPLOAD_PUBLIC_URL;
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "upload public URL is not configured",
    );
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockWriteSSH).not.toHaveBeenCalled();
  });

  // -- Filesystem write failure ----------------------------------------------

  it("should handle filesystem write failures gracefully", async () => {
    mockWriteFile.mockRejectedValueOnce(
      new Error("ENOSPC: no space left on device"),
    );
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "Failed to save the image",
    );
  });

  it("should handle mkdir failures gracefully", async () => {
    mockMkdir.mockRejectedValueOnce(new Error("EACCES: permission denied"));
    const { uploadImageToVPS } = await importService();
    const file = makeImageFile(JPEG_MAGIC, "test.jpg", "image/jpeg");

    await expect(uploadImageToVPS(file)).rejects.toThrow(
      "Upload storage is unavailable",
    );
  });
});

// ---- Deletion tests --------------------------------------------------------

describe("upload.service deletion", () => {
  const UPLOAD_DIR = "/var/www/uploads/bangbuy";
  const UPLOAD_PUBLIC_URL = "https://example.com/uploads";

  beforeEach(() => {
    process.env.UPLOAD_DIR = UPLOAD_DIR;
    process.env.UPLOAD_PUBLIC_URL = UPLOAD_PUBLIC_URL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_URL;
  });

  async function importService() {
    vi.resetModules();
    return import("@/lib/services/upload.service");
  }

  it("should delete a VPS-hosted image", async () => {
    const { deleteUploadedFile } = await importService();
    const url = `${UPLOAD_PUBLIC_URL}/products/abc123.webp`;

    const deleted = await deleteUploadedFile(url);

    expect(deleted).toBe(true);
    expect(mockUnlink).toHaveBeenCalledWith(
      resolve(UPLOAD_DIR, "products/abc123.webp"),
    );
  });

  it("deletes SSH-hosted images on the VPS without probing the local filesystem", async () => {
    vi.stubEnv("UPLOAD_STORAGE", "ssh");
    const { deleteUploadedFile } = await importService();
    const filename = "mgoe4ftp-0123456789abcdef01234567.webp";

    await expect(deleteUploadedFile(`${UPLOAD_PUBLIC_URL}/products/${filename}`)).resolves.toBe(true);
    expect(mockDeleteSSH).toHaveBeenCalledWith(UPLOAD_DIR, "products", filename);
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("preserves missing-file deletion results from the VPS", async () => {
    vi.stubEnv("UPLOAD_STORAGE", "ssh");
    mockDeleteSSH.mockResolvedValueOnce(false);
    const { deleteUploadedFile } = await importService();

    await expect(deleteUploadedFile(`${UPLOAD_PUBLIC_URL}/other/mgoe4ftp-0123456789abcdef01234567.webp`))
      .resolves.toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("should NOT attempt to delete ImgBB URLs", async () => {
    const { deleteUploadedFile } = await importService();
    const url = "https://i.ibb.co/abc123/image.jpg";

    const deleted = await deleteUploadedFile(url);

    expect(deleted).toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("should NOT delete files outside the upload directory", async () => {
    const { deleteUploadedFile } = await importService();
    // Crafted URL that tries to escape
    const url = `${UPLOAD_PUBLIC_URL}/../../../etc/passwd`;

    const deleted = await deleteUploadedFile(url);

    expect(deleted).toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("should handle already-deleted files gracefully", async () => {
    const enoent = new Error("ENOENT: no such file or directory") as Error & {
      code: string;
    };
    enoent.code = "ENOENT";
    mockStat.mockRejectedValueOnce(enoent);

    const { deleteUploadedFile } = await importService();
    const url = `${UPLOAD_PUBLIC_URL}/products/gone.webp`;

    const deleted = await deleteUploadedFile(url);

    expect(deleted).toBe(false);
  });

  it("should verify the file is actually a file before deleting", async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => false });

    const { deleteUploadedFile } = await importService();
    const url = `${UPLOAD_PUBLIC_URL}/products/dir-trick`;

    const deleted = await deleteUploadedFile(url);

    expect(deleted).toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

// ---- Path resolution tests -------------------------------------------------

describe("upload.service path resolution", () => {
  beforeEach(() => {
    process.env.UPLOAD_DIR = "/var/www/uploads/bangbuy";
    process.env.UPLOAD_PUBLIC_URL = "https://example.com/uploads";
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_URL;
  });

  async function importService() {
    vi.resetModules();
    return import("@/lib/services/upload.service");
  }

  it("should resolve VPS upload URLs to filesystem paths", async () => {
    const { resolveUploadPath } = await importService();
    const path = resolveUploadPath(
      "https://example.com/uploads/products/test.webp",
    );
    expect(path).toBe(
      resolve("/var/www/uploads/bangbuy", "products/test.webp"),
    );
  });

  it("should return null for ImgBB URLs", async () => {
    const { resolveUploadPath } = await importService();
    const path = resolveUploadPath("https://i.ibb.co/abc/image.jpg");
    expect(path).toBeNull();
  });

  it("rejects URLs whose path only begins with the public upload prefix", async () => {
    const { resolveUploadPath } = await importService();
    expect(resolveUploadPath("https://example.com/uploads-other/products/test.webp")).toBeNull();
  });

  it("should return null for path traversal attempts", async () => {
    const { resolveUploadPath } = await importService();
    const path = resolveUploadPath(
      "https://example.com/uploads/../../../etc/passwd",
    );
    expect(path).toBeNull();
  });

  it("should correctly identify files inside the upload dir", async () => {
    const { isInsideUploadDir } = await importService();

    expect(
      isInsideUploadDir("/var/www/uploads/bangbuy/products/test.webp"),
    ).toBe(true);
    expect(isInsideUploadDir("/etc/passwd")).toBe(false);
    expect(
      isInsideUploadDir("/var/www/uploads/bangbuy/../../../etc/passwd"),
    ).toBe(false);
  });
});

// ---- Legacy ImgBB URL preservation -----------------------------------------

describe("legacy ImgBB URL preservation", () => {
  beforeEach(() => {
    process.env.UPLOAD_DIR = "/var/www/uploads/bangbuy";
    process.env.UPLOAD_PUBLIC_URL = "https://example.com/uploads";
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_URL;
  });

  async function importService() {
    vi.resetModules();
    return import("@/lib/services/upload.service");
  }

  it("should not resolve legacy ImgBB URLs as local paths", async () => {
    const { resolveUploadPath } = await importService();

    // These are real ImgBB URL patterns from the database
    const imgbbUrls = [
      "https://i.ibb.co/hxy6SBj7/d626cb3ea96a.jpg",
      "https://i.ibb.co/5pdknZs/f885b6dd45d6.jpg",
      "https://i.ibb.co/RpNQxD18/775470f1eeb7.jpg",
    ];

    for (const url of imgbbUrls) {
      expect(resolveUploadPath(url)).toBeNull();
    }
  });

  it("should never attempt to delete ImgBB images from VPS", async () => {
    const { deleteUploadedFile } = await importService();

    const imgbbUrl = "https://i.ibb.co/hxy6SBj7/d626cb3ea96a.jpg";
    const result = await deleteUploadedFile(imgbbUrl);

    expect(result).toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});
