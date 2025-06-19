import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";

export const BankFillable = [
    'name',
    'image_url',
    'bank_code',
    'is_active'
];

export const BankUpdateable = BankFillable;

@Entity()
export class Banks {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    image_url?: string;

    @Column()
    bank_code!: string;
    
    @Column()
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}