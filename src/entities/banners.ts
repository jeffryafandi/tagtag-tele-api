    import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";

export const BannerFillable = [
    'title',
    'link',
    'image_url',
    'is_active',
    'type'
];

export const BannerUpdateable = [
    'title',
    'link',
    'image_url',
    'is_active',
    'type'
];

@Entity()
export class Banners {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column()
    link!: string;

    @Column()
    image_url!: string;
    
    @Column()
    type!: string;

    @Column()
    platform!: string;

    @Column()
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
}