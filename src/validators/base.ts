import { validate, IsIn, IsEmail, IsDefined, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { Validation } from '../interfaces/generals/validation';

export class Validator {
    private rules;

    constructor(rules: any) {
        this.rules = rules;
    }

    public generateErrorMessage(errorItem: ValidationError, errorMessage: string = '', currentProperty = ''): string {
        let message = '';
        const props = currentProperty ? `${currentProperty}.${errorItem.property}` : errorItem.property;
        
        if (errorItem.constraints) {
            const constraint = errorItem.constraints;
            message = constraint[Object.keys(constraint)[0]];
            return `${props}: ${message}`;
        }

        if (errorItem.children) {
            for (const children of errorItem.children) {
                message = this.generateErrorMessage(children, errorMessage, props);
                if (message !== '') break;
            }
        }
        return message;
    }

    public async validate(payload: object): Promise<Validation>{
        const validation: any = plainToClass(this.rules, payload);

        return await validate(validation, { skipMissingProperties: true }).then(errors => {
            // errors is an array of validation errors
            if (errors.length > 0) {
                let errorTexts = '';
                for (const errorItem of errors) {
                    errorTexts = this.generateErrorMessage(errorItem);
                    break;
                }

                return {
                    'status'    : false,
                    'message'   : errorTexts
                };
            }else{
                return {
                    'status'    : true,
                    'message'   : ''
                };
            }
        });
    }
}