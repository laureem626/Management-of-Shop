import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TenantUser } from '../../tenants/entity/tenant-user.entity';


@Entity({ name: 'shops', schema: 'public' })
export class Shop {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;


  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ unique: true })
  schemaName: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TenantUser, (tenantUser) => tenantUser.shop)
  tenantUsers: TenantUser[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}