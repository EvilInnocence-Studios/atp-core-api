import { Response } from "express";

interface IError {
    statusCode: number;
    message: string;
}

export const addJson = (response:Response) => {
    response.append('Content-Type', 'application/json');
};

const isError = (e:any):e is IError => e.message && e.statusCode;
export const error = (statusCode:number, message:string):IError => ({statusCode, message});
export const error401 = error(401, "Unauthorized");
export const error403 = error(403, "Permission denied");
export const error500 = (message:string = "Something bad happened. I don't know what else to tell you. :("):IError => error(500, message);
export const error409 = (message:string = "Conflict"):IError => error(409, message);

// More fully type this
export const catchErrors = async <T>(response:Response, f:() => Promise<T>) => {
    f()
        .then((results:T) => {
            response.statusCode = 200;
            // addCors(response);
            addJson(response);
            response.send(JSON.stringify(results));
        })
            
        .catch(e => {
            console.log(e);
            const err:IError = isError(e) ? e : {
              message: `Something bad happened. I don't know what else to tell you. :( -- ${JSON.stringify(e)}`,
              statusCode: 500,
            };
            
            response.statusCode = e.statusCode || 500;
            // addCors(response);
            addJson(response);
            response.send(JSON.stringify({message: e.message}));
        });
};
