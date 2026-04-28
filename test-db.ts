import { prisma } from "./lib/prisma";

async function main() {
  try {
    console.log("Connecting to database...");
    const settings = await prisma.settings.findFirst();
    console.log("Connection successful! Settings:", settings);
  } catch (error) {
    console.error("Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
