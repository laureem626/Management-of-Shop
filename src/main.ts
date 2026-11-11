import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; 
import { Logger } from '@nestjs/common';  
import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';                      

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const configService = new ConfigService();
  const port = configService.get('PORT') ?? 3000;
   const config = new DocumentBuilder()
    .setTitle('Shop Management API')
    .setDescription('API documentation for Shop Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  
  await app.listen(port);
  const logger = new Logger();
  logger.log(`Application running on port ${port}`);
}

void bootstrap();
