import { Connection } from "typeorm";
import { HelperService } from "./helper";

export class BaseService {
    protected dbConn        : Connection;
    public helperService    : HelperService;

    constructor(dbConn: Connection) {
        this.dbConn             = dbConn
        this.helperService      = new HelperService();
    }
}