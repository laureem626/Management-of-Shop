import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
    Generated,
} from 'typeorm';


@Entity({ name: 'shops', schema: 'public' })export class Shop {
  @PrimaryGeneratedColumn()
  id: number;

  @Generated('uuid')
  uuid: string;


  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ unique: true })
  schemaName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}