import * as lambda from 'aws-lambda';
import { Connection } from 'typeorm';
import { Database } from "./database";
import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();
console.log("ABC");
/** create DB connection */ 
const database = new Database();
