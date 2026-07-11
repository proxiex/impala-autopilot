/**
 * Seed a handful of sample products into the configured ImpalaFlow tenant so
 * there's a catalog to demo against. Idempotency is not guaranteed — running it
 * twice creates duplicates.
 *
 *   npm run seed
 */
import { loadSettings } from "./config";
import { ImpalaFlowClient } from "./impala/client";

const PRODUCTS = [
  { name: "Bag of Rice 25kg", price: 320, stock: 40, description: "Long-grain perfumed rice, 25kg bag." },
  { name: "Cooking Oil 5L", price: 145, stock: 60, description: "Pure vegetable cooking oil, 5 litres." },
  { name: "Milo Tin 400g", price: 55, stock: 100, description: "Milo chocolate malt drink, 400g tin." },
  { name: "Bottled Water (pack of 12)", price: 30, stock: 200, description: "500ml bottled water, pack of 12." },
  { name: "Bar Soap (pack of 6)", price: 25, stock: 150, description: "Household bar soap, pack of 6." },
];

async function main(): Promise<void> {
  const settings = loadSettings();
  const client = new ImpalaFlowClient(settings);
  await client.login();
  console.log(
    `Seeding ${PRODUCTS.length} products into tenant ${client.tenantId} (prices in the store currency)…`,
  );

  for (const p of PRODUCTS) {
    const payload = {
      name: p.name,
      price: p.price,
      item_type: "product",
      description: p.description,
      stock: p.stock,
      track_inventory: true,
      charge_tax: false,
      requires_shipping: true,
    };
    try {
      const res: any = await client.post("/api/private/products", payload);
      console.log(`  ✓ ${p.name} @ ${p.price} → ${res?.id ?? "created"}`);
    } catch (err: any) {
      console.log(`  ✗ ${p.name}: ${err?.message ?? err}`);
    }
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
