import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const driver = await prisma.user.upsert({
    where: { phone: "9999999901" },
    update: {},
    create: {
      phone: "9999999901",
      name: "Ravi K",
      role: "DRIVER",
      ratingAvg: 4.8,
    },
  });

  const passenger = await prisma.user.upsert({
    where: { phone: "9999999902" },
    update: {},
    create: {
      phone: "9999999902",
      name: "Meena P",
      role: "PASSENGER",
      ratingAvg: 4.7,
    },
  });

  await prisma.vehicle.upsert({
    where: { id: "seed-vehicle-1" },
    update: {},
    create: {
      id: "seed-vehicle-1",
      driverId: driver.id,
      make: "Maruti",
      model: "Swift Dzire",
      regNumber: "TN09AB1234",
      color: "White",
    },
  });

  await prisma.ride.upsert({
    where: { id: "seed-ride-1" },
    update: {},
    create: {
      id: "seed-ride-1",
      driverId: driver.id,
      sourceLat: 12.9352, sourceLng: 77.6146, sourceAddress: "Koramangala, Bengaluru",
      destLat: 13.0067, destLng: 80.2206, destAddress: "OMR, Chennai",
      travelDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      seatsAvailable: 3,
      pricePerSeat: 320,
      preferences: { music: true, pets: true, smoking: false },
    },
  });

  console.log("Seed complete:", { driver: driver.phone, passenger: passenger.phone });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
