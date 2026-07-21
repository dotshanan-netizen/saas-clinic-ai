import { prisma } from '../src/lib/db';

async function seedDoctorServices() {
  const doctors = await prisma.doctor.findMany();
  const services = await prisma.service.findMany();

  for (const doc of doctors) {
    for (const srv of services) {
      await prisma.doctorService.upsert({
        where: {
          doctorId_serviceId: {
            doctorId: doc.id,
            serviceId: srv.id,
          }
        },
        update: {},
        create: {
          doctorId: doc.id,
          serviceId: srv.id,
        }
      });
    }
  }
  console.log("Doctors mapped to all services successfully!");
}

seedDoctorServices()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
