import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../../app.module';
import { User } from '../../public/entity/users.entity';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepository = app.get<Repository<User>>(
      getRepositoryToken(User),
    );

    const email = 'admin@gmail.com';

    const existingAdmin = await userRepository.findOne({
      where: { email },
    });

    if (existingAdmin) {
      console.log('Admin already seeded.');
      return;
    }

    const admin = userRepository.create({
      firstName: 'System',
      lastName: 'Administrator',
      email,
      password: await bcrypt.hash('Admin@132', 10),
      isActive: true,
      isVerified: true,
       isSuperAdmin: true,
    });

    await userRepository.save(admin);

    console.log('Admin seeded successfully.');
  } catch (error) {
    console.error('Admin seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seedAdmin();