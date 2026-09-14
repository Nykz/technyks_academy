import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { LEGACY_TEMPLATE_CATALOG } from './legacy-template-catalog.data';

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (this.prisma.isDbConnected) {
      for (const product of LEGACY_TEMPLATE_CATALOG) {
        await this.prisma.uiTemplate.upsert({
          where: { slug: product.slug },
          update: {},
          create: product,
        });
      }
      return;
    }
    const existingSlugs = new Set(
      this.prisma.inMemoryUiTemplates.map((item) => item.slug),
    );
    this.prisma.inMemoryUiTemplates.push(
      ...LEGACY_TEMPLATE_CATALOG.filter(
        (item) => !existingSlugs.has(item.slug),
      ).map((item) => ({
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  async listPublic() {
    const items = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findMany({
          where: { isPublished: true },
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        })
      : this.prisma.inMemoryUiTemplates
          .filter((item) => item.isPublished)
          .sort(
            (a, b) =>
              Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)),
          );
    return items.map((item) => this.toPublic(item));
  }

  async getPublicBySlug(slug: string) {
    const cleanSlug = String(slug || '')
      .trim()
      .toLowerCase();
    const item = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findFirst({
          where: { slug: cleanSlug, isPublished: true },
        })
      : this.prisma.inMemoryUiTemplates.find(
          (candidate) => candidate.slug === cleanSlug && candidate.isPublished,
        );
    if (!item) throw new NotFoundException('UI template not found.');
    return this.toPublic(item);
  }

  async findCheckoutProducts(ids: string[]) {
    const uniqueIds = [...new Set(ids.map(String).filter(Boolean))];
    if (!uniqueIds.length || uniqueIds.length > 20) {
      throw new BadRequestException('Choose between 1 and 20 UI templates.');
    }
    const items = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findMany({
          where: { id: { in: uniqueIds }, isPublished: true },
        })
      : this.prisma.inMemoryUiTemplates.filter(
          (item) => uniqueIds.includes(item.id) && item.isPublished,
        );
    if (items.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One of the selected UI templates is no longer available.',
      );
    }
    return uniqueIds.map((id) => items.find((item) => item.id === id)!);
  }

  async listAdmin() {
    const items = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findMany({
          orderBy: { updatedAt: 'desc' },
        })
      : [...this.prisma.inMemoryUiTemplates].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
    return items.map((item) => this.toAdmin(item));
  }

  async getAdmin(id: string) {
    return this.toAdmin(await this.findAdmin(id));
  }

  async listOrders() {
    const purchases = this.prisma.isDbConnected
      ? await this.prisma.uiTemplatePurchase.findMany({
          include: {
            product: { select: { id: true, slug: true, title: true } },
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [...this.prisma.inMemoryUiTemplatePurchases]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .map((purchase) => ({
            ...purchase,
            product: this.prisma.inMemoryUiTemplates.find(
              (item) => item.id === purchase.productId,
            ),
            user: this.prisma.inMemoryUsers.find(
              (item) => item.id === purchase.userId,
            ),
          }));
    return purchases.map((purchase: any) => ({
      id: purchase.id,
      purchasedAt: purchase.createdAt,
      amount: Number(purchase.amount || 0),
      currency: purchase.currency,
      paymentId: purchase.paymentId || null,
      status: 'COMPLETED',
      product: {
        id: purchase.product?.id || purchase.productId,
        slug: purchase.product?.slug || '',
        title: purchase.product?.title || 'Deleted product',
      },
      buyer: {
        id: purchase.user?.id || purchase.userId,
        name: purchase.user?.name || 'Customer',
        email: purchase.user?.email || '',
      },
    }));
  }

  async create(input: any) {
    const data = this.cleanInput(input, true);
    const duplicate = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findUnique({ where: { slug: data.slug } })
      : this.prisma.inMemoryUiTemplates.find((item) => item.slug === data.slug);
    if (duplicate)
      throw new ConflictException('This product URL is already in use.');
    const item = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.create({ data })
      : {
          id: randomUUID(),
          ...data,
          filePath: null,
          fileName: null,
          fileSize: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
    if (!this.prisma.isDbConnected)
      this.prisma.inMemoryUiTemplates.unshift(item);
    return this.toAdmin(item);
  }

  async update(id: string, input: any) {
    const existing = await this.findAdmin(id);
    const data = this.cleanInput({ ...existing, ...input }, false);
    const duplicate = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findFirst({
          where: { slug: data.slug, NOT: { id } },
        })
      : this.prisma.inMemoryUiTemplates.find(
          (item) => item.slug === data.slug && item.id !== id,
        );
    if (duplicate)
      throw new ConflictException('This product URL is already in use.');
    const item = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.update({ where: { id }, data })
      : Object.assign(existing, data, { updatedAt: new Date() });
    return this.toAdmin(item);
  }

  async storeProductFile(id: string, file?: any) {
    const product = await this.findAdmin(id);
    if (!file?.buffer?.length)
      throw new BadRequestException('Choose a ZIP file.');
    const extension = String(file.originalname || '')
      .toLowerCase()
      .endsWith('.zip');
    const hasZipHeader =
      file.buffer[0] === 0x50 &&
      file.buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(file.buffer[2]);
    if (!extension || !hasZipHeader) {
      throw new BadRequestException(
        'Template downloads must be a valid ZIP file.',
      );
    }
    const size = Number(file.size || file.buffer.length);
    if (size > 50 * 1024 * 1024) {
      throw new BadRequestException(
        'Template ZIP files must be 50 MB or smaller.',
      );
    }

    const directory = this.privateDirectory();
    await mkdir(directory, { recursive: true });
    const storedName = `${id}-${Date.now()}-${randomUUID()}.zip`;
    const path = join(directory, storedName);
    await writeFile(path, file.buffer, { mode: 0o600 });

    const originalPath = String(product.filePath || '');
    const update = {
      filePath: path,
      fileName: this.safeDownloadName(file.originalname),
      fileSize: size,
    };
    const saved = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.update({ where: { id }, data: update })
      : Object.assign(product, update, { updatedAt: new Date() });
    if (originalPath) await this.removePrivateFile(originalPath);
    return this.toAdmin(saved);
  }

  async remove(id: string) {
    const product = await this.findAdmin(id);
    const purchaseCount = this.prisma.isDbConnected
      ? await this.prisma.uiTemplatePurchase.count({ where: { productId: id } })
      : this.prisma.inMemoryUiTemplatePurchases.filter(
          (purchase) => purchase.productId === id,
        ).length;
    if (purchaseCount) {
      throw new ConflictException(
        'This product has buyers. Unpublish it instead so their downloads remain available.',
      );
    }
    if (this.prisma.isDbConnected) {
      await this.prisma.uiTemplate.delete({ where: { id } });
    } else {
      this.prisma.inMemoryUiTemplates = this.prisma.inMemoryUiTemplates.filter(
        (item) => item.id !== id,
      );
    }
    if (product.filePath) await this.removePrivateFile(product.filePath);
    return { success: true };
  }

  async listPurchases(userId: string) {
    if (this.prisma.isDbConnected) {
      const purchases = await this.prisma.uiTemplatePurchase.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
      return purchases.map((purchase) => ({
        id: purchase.id,
        purchasedAt: purchase.createdAt,
        amount: purchase.amount,
        currency: purchase.currency,
        product: this.toPurchasedProduct(purchase.product),
      }));
    }
    return this.prisma.inMemoryUiTemplatePurchases
      .filter((purchase) => purchase.userId === userId)
      .map((purchase) => ({
        ...purchase,
        purchasedAt: purchase.createdAt,
        product: this.toPurchasedProduct(
          this.prisma.inMemoryUiTemplates.find(
            (item) => item.id === purchase.productId,
          ),
        ),
      }));
  }

  async getPurchasedDelivery(userId: string, productId: string) {
    const product = await this.getPurchasedProduct(userId, productId);
    if (product.deliveryUrl) {
      return {
        type: 'external',
        url: this.optionalHttpsUrl(product.deliveryUrl, 'Delivery link'),
        buttonText: product.downloadButtonText || 'Open download',
      };
    }
    if (!product.filePath || !existsSync(String(product.filePath))) {
      throw new NotFoundException(
        'The download is being prepared. Please contact support.',
      );
    }
    return {
      type: 'file',
      buttonText: product.downloadButtonText || 'Download files',
      fileName: product.fileName || `${product.slug}.zip`,
    };
  }

  async getPurchasedFile(userId: string, productId: string) {
    const product = await this.getPurchasedProduct(userId, productId);
    const path = String(product?.filePath || '');
    if (!path || !existsSync(path)) {
      throw new NotFoundException(
        'The download file is being prepared. Please contact support.',
      );
    }
    return {
      path,
      size: Number(product.fileSize || 0),
      downloadName: this.safeDownloadName(
        product.fileName || `${product.slug}.zip`,
      ),
    };
  }

  private async getPurchasedProduct(userId: string, productId: string) {
    const purchase = this.prisma.isDbConnected
      ? await this.prisma.uiTemplatePurchase.findUnique({
          where: { userId_productId: { userId, productId } },
          include: { product: true },
        })
      : this.prisma.inMemoryUiTemplatePurchases.find(
          (item) => item.userId === userId && item.productId === productId,
        );
    if (!purchase) throw new NotFoundException('Purchased template not found.');
    const product = this.prisma.isDbConnected
      ? (purchase as any).product
      : this.prisma.inMemoryUiTemplates.find((item) => item.id === productId);
    if (!product) throw new NotFoundException('Purchased template not found.');
    return product;
  }

  private async findAdmin(id: string): Promise<any> {
    const item = this.prisma.isDbConnected
      ? await this.prisma.uiTemplate.findUnique({ where: { id } })
      : this.prisma.inMemoryUiTemplates.find(
          (candidate) => candidate.id === id,
        );
    if (!item) throw new NotFoundException('UI template not found.');
    return item;
  }

  private cleanInput(input: any, creating: boolean): any {
    const title = this.text(input.title, 'Product title', 3, 191);
    const slug = String(input.slug || title)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 191);
    if (!slug) throw new BadRequestException('Add a valid product URL.');
    const price = Number(input.price || 0);
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
      throw new BadRequestException('Add a valid product price.');
    }
    const tags = Array.isArray(input.tags)
      ? input.tags
      : String(input.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
    return {
      ...(creating ? {} : { slug }),
      slug,
      title,
      tagline: this.text(input.tagline, 'Short description', 5, 300),
      description: this.text(input.description, 'Description', 20, 20_000),
      thumbnail: this.optionalMediaUrl(input.thumbnail, 'Thumbnail'),
      promoVideoUrl: this.optionalMediaUrl(
        input.promoVideoUrl,
        'Promotional video',
      ),
      previewUrl: String(input.previewUrl || '').trim() || null,
      deliveryUrl: this.optionalHttpsUrl(input.deliveryUrl, 'Delivery link'),
      downloadButtonText: this.optionalText(
        input.downloadButtonText || 'Download files',
        'Download button text',
        80,
      ),
      buyerMessage: this.optionalText(
        input.buyerMessage,
        'Buyer message',
        2_000,
      ),
      price,
      currency: String(input.currency || 'INR')
        .trim()
        .toUpperCase()
        .slice(0, 16),
      category: this.text(input.category || 'Website UI', 'Category', 2, 120),
      tags: [...new Set(tags.map(String).filter(Boolean))].slice(0, 12),
      isPublished: Boolean(input.isPublished),
      isFeatured: Boolean(input.isFeatured),
    };
  }

  private text(value: unknown, label: string, min: number, max: number) {
    const clean = String(value || '').trim();
    if (clean.length < min || clean.length > max) {
      throw new BadRequestException(
        `${label} must be ${min}-${max} characters.`,
      );
    }
    return clean;
  }

  private optionalText(value: unknown, label: string, max: number) {
    const clean = String(value || '').trim();
    if (clean.length > max) {
      throw new BadRequestException(
        `${label} must be ${max} characters or fewer.`,
      );
    }
    return clean || null;
  }

  private optionalHttpsUrl(value: unknown, label: string) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    try {
      const url = new URL(clean);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
      return url.toString();
    } catch {
      throw new BadRequestException(`${label} must be a complete HTTPS URL.`);
    }
  }

  private optionalMediaUrl(value: unknown, label: string) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    if (/^\/(?:assets|uploads)\/[A-Za-z0-9_./-]+$/.test(clean)) return clean;
    try {
      const url = new URL(clean);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
      return url.toString();
    } catch {
      throw new BadRequestException(
        `${label} must be an uploaded file or a complete HTTPS URL.`,
      );
    }
  }

  private toPublic(item: any) {
    if (!item) return null;
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      tagline: item.tagline,
      description: item.description,
      thumbnail: item.thumbnail,
      promoVideoUrl: item.promoVideoUrl || null,
      previewUrl: item.previewUrl,
      price: Number(item.price),
      currency: item.currency,
      category: item.category,
      tags: Array.isArray(item.tags)
        ? item.tags
        : this.parseJson(item.tags, []),
      isFeatured: Boolean(item.isFeatured),
      fileReady: Boolean(item.filePath || item.deliveryUrl),
      updatedAt: item.updatedAt,
    };
  }

  private toAdmin(item: any) {
    return {
      ...this.toPublic(item),
      isPublished: Boolean(item.isPublished),
      fileName: item.fileName || null,
      fileSize: Number(item.fileSize || 0),
      deliveryUrl: item.deliveryUrl || null,
      downloadButtonText: item.downloadButtonText || 'Download files',
      buyerMessage: item.buyerMessage || null,
      createdAt: item.createdAt,
    };
  }

  private toPurchasedProduct(item: any) {
    return {
      ...this.toPublic(item),
      downloadButtonText: item.downloadButtonText || 'Download files',
      buyerMessage: item.buyerMessage || null,
      deliveryType: item.deliveryUrl ? 'external' : 'file',
    };
  }

  private parseJson(value: unknown, fallback: any) {
    if (typeof value !== 'string') return value ?? fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private privateDirectory() {
    return resolve(
      String(
        process.env.PRIVATE_UPLOADS_DIR ||
          join(process.cwd(), 'private_uploads', 'templates'),
      ).trim(),
    );
  }

  private async removePrivateFile(pathValue: string) {
    const directory = this.privateDirectory();
    const path = resolve(pathValue);
    const childPath = relative(directory, path);
    if (!childPath || childPath.startsWith('..') || isAbsolute(childPath))
      return;
    try {
      await unlink(path);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  private safeDownloadName(value: string) {
    const clean = basename(String(value || 'template.zip')).replace(
      /[^a-zA-Z0-9._-]+/g,
      '-',
    );
    return clean.toLowerCase().endsWith('.zip') ? clean : `${clean}.zip`;
  }
}
