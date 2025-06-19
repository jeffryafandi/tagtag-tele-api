import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { UserExtPrizes } from "./user-ext-prizes";
import { RafflePrizes } from "./raffle-prizes";
import { Operators } from "./operators";

export const ExtPrizeFillable = [
    'operator_id',
    'code',
    'name',
    'description',
    'image_url',
];

export const ExtPrizeUpdateable = ExtPrizeFillable;

@Entity()
export class ExtPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    operator_id!: number;
    
    @Column({type: 'varchar'})
    code!: string;
    
    @Column({type: 'varchar'})
    name!: string;

    @Column({type: 'varchar'})
    description!: string;

    @Column({type: 'varchar'})
    image_url!: string;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToMany(type => UserExtPrizes, userExtPrizes => userExtPrizes.extPrizes)
    userExtPrizes!: UserExtPrizes[];
   
    @OneToMany(type => RafflePrizes, rafflePrizes => rafflePrizes.extPrizes)
    rafflePrizes?: RafflePrizes[];

    @ManyToOne(type => Operators, operators => operators.extPrizes)
    @JoinColumn({
        name: "operator_id"
    })
    operators?: Operators;
    
}

