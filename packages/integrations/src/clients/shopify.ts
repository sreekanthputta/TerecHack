import { env } from "../env.js";
import { logger } from "../logger.js";

export type ShopifyProductInput = {
  title: string;
  description_html?: string;
  price_usd: number;
  images?: string[];
  vendor?: string;
  product_type?: string;
};

export type ShopifyProductResult = {
  product_id: string;
  storefront_url: string;
};

export async function createProduct(
  input: ShopifyProductInput,
): Promise<ShopifyProductResult> {
  if (env.FIXTURE_MODE) {
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return {
      product_id: `gid://shopify/Product/fx_${slug}`,
      storefront_url: `https://${env.SHOPIFY_SHOP_DOMAIN || "fixture.myshopify.com"}/products/${slug}`,
    };
  }

  const res = await fetch(
    `https://${env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/products.json`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({
        product: {
          title: input.title,
          body_html: input.description_html ?? "",
          vendor: input.vendor ?? "AutoBusiness",
          product_type: input.product_type ?? "",
          images: (input.images ?? []).map((src) => ({ src })),
          variants: [
            { price: input.price_usd.toFixed(2), inventory_management: null },
          ],
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`shopify create-product ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { product: { id: number; handle: string } };
  logger.info({ product_id: data.product.id }, "shopify product created");
  return {
    product_id: String(data.product.id),
    storefront_url: `https://${env.SHOPIFY_SHOP_DOMAIN}/products/${data.product.handle}`,
  };
}
