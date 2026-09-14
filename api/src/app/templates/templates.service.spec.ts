import { describe, expect, it } from 'vitest';
import { TemplatesService } from './templates.service';

function memoryPrisma() {
  return {
    isDbConnected: false,
    inMemoryUsers: [],
    inMemoryUiTemplates: [],
    inMemoryUiTemplatePurchases: [],
  } as any;
}

describe('TemplatesService', () => {
  it('seeds the shop without exposing private file paths publicly', async () => {
    const prisma = memoryPrisma();
    const service = new TemplatesService(prisma);
    await service.onModuleInit();

    prisma.inMemoryUiTemplates[0].filePath = 'C:\\private\\paid-template.zip';
    const products = await service.listPublic();

    expect(products.length).toBeGreaterThanOrEqual(3);
    expect(products[0].fileReady).toBe(true);
    expect(products[0]).not.toHaveProperty('filePath');
  });

  it('keeps a purchase available after the public price changes', async () => {
    const prisma = memoryPrisma();
    const service = new TemplatesService(prisma);
    await service.onModuleInit();
    const product = prisma.inMemoryUiTemplates[0];
    prisma.inMemoryUiTemplatePurchases.push({
      id: 'purchase-1', userId: 'student-1', productId: product.id,
      amount: 0, currency: 'INR', paymentId: 'payment-1', createdAt: new Date(),
    });

    product.price = 4999;
    product.isPublished = false;
    const purchases = await service.listPurchases('student-1');

    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({ id: 'purchase-1', amount: 0 });
    expect(purchases[0].product.id).toBe(product.id);
  });

  it('protects external delivery links until the buyer owns the product', async () => {
    const prisma = memoryPrisma();
    const service = new TemplatesService(prisma);
    await service.onModuleInit();
    const product = prisma.inMemoryUiTemplates[0];
    product.deliveryUrl = 'https://downloads.example.com/template.zip';
    product.downloadButtonText = 'Open your files';

    const publicProduct = (await service.listPublic())[0];
    expect(publicProduct.fileReady).toBe(true);
    expect(publicProduct).not.toHaveProperty('deliveryUrl');

    prisma.inMemoryUiTemplatePurchases.push({
      id: 'purchase-2', userId: 'student-2', productId: product.id,
      amount: 1299, currency: 'INR', paymentId: 'payment-2', createdAt: new Date(),
    });
    await expect(service.getPurchasedDelivery('student-2', product.id)).resolves.toEqual({
      type: 'external',
      url: 'https://downloads.example.com/template.zip',
      buttonText: 'Open your files',
    });
  });

  it('lists only template purchases in the product orders view', async () => {
    const prisma = memoryPrisma();
    const service = new TemplatesService(prisma);
    await service.onModuleInit();
    const product = prisma.inMemoryUiTemplates[0];
    prisma.inMemoryUsers.push({
      id: 'student-3', name: 'Template Buyer', email: 'buyer@example.test',
    });
    prisma.inMemoryUiTemplatePurchases.push({
      id: 'purchase-3', userId: 'student-3', productId: product.id,
      amount: 799, currency: 'INR', paymentId: 'payment-3', createdAt: new Date(),
    });

    const orders = await service.listOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      id: 'purchase-3',
      amount: 799,
      status: 'COMPLETED',
      product: { id: product.id, title: product.title },
      buyer: { name: 'Template Buyer', email: 'buyer@example.test' },
    });
  });
});
