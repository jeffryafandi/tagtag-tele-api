import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";

export const AppConfigsFillable = [
  "config_key",
  "config_value",
  "is_active",
  "is_public",
];

export const AppConfigsUpdateable = AppConfigsFillable;

@Entity()
export class AppConfigs {
  @Column({ type: "varchar", length: 100, primary: true })
  config_key!: string;

  @Column({ type: "text" })
  config_value!: string;

  @Column()
  is_active?: boolean;

  @Column()
  is_public?: boolean;

  @Column("timestamp")
  created_at?: string;

  @Column("timestamp")
  updated_at?: string;
}
