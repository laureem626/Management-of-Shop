import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entity/users.entity';
import { Shop } from '../../shop/entity/shop.entity';


export enum TenantUserRole {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  CASHIER = 'Cashier',
  STAFF = 'Staff',
}

@Entity({ name: 'tenant_users', schema: 'public' })
@Unique(['userId', 'shopId'])
export class TenantUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @Column({
    type: 'enum',
    enum: TenantUserRole,
    default: TenantUserRole.STAFF,
  })
  role: TenantUserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.shops, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  shopId: number;

  @ManyToOne(() => Shop, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}