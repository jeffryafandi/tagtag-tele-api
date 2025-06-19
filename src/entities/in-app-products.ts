import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { InAppProductContents } from "./in-app-product-contents";

export const InAppProductFillable = [
    'name',
    'ext_product_id',
    'price'
];

export const InAppProductUpdateable = [
    'name',
    'ext_product_id',
    'price'
];

@Entity()
export class InAppProducts {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar', nullable: false})
    name!: string;

    @Column({type: 'varchar', nullable: false})
    ext_product_id!: string;

    @Column({type: 'integer', nullable: false})
    price!: number;

    @Column({type: 'varchar', nullable: false})
    description!: string;

    @Column({type: 'varchar', nullable: false})
    group_name!: string;

    @Column({type: 'varchar', nullable: false})
    category!: string;

    @Column()
    is_shown!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToOne(type => InAppProductContents, content => content.product)
    content?: InAppProductContents;
}