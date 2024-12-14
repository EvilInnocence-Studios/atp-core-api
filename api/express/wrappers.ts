import { Request, RequestHandler, Response } from "express";
import { DeleteFunction, GetFunction, PatchFunction, PostFunction, PutFunction } from "./types";
import { catchErrors, parseNestedQuery } from "./util";

export const get = <T>(f:GetFunction<T>):RequestHandler => (request:Request, response:Response) => {
  const query = request.query;
  catchErrors<T>(response, () => f(
    request.params,
    !!query ? parseNestedQuery(query) : null,
    request.headers,
    process.env,
  ));
};
  
export const post = <Result, Body = Partial<Result>>(f:PostFunction<Result, Body>):RequestHandler => (request:Request, response:Response) => {
  catchErrors<Result>(response, () => f(
    request.params,
    request.body,
    request.headers,
    process.env,
  ));
};

export const put = <T>(f:PutFunction<T>):RequestHandler => (request:Request, response:Response) => {
    catchErrors<T>(response, () => f(
      request.params,
      request.body,
      request.headers,
      process.env,
    ));
  };
    
  export const patch = <Result, Body = Result>(f:PatchFunction<Result, Body>) => (request:Request, response:Response) => {
    catchErrors<Result>(response, () => f(
      request.params,
      request.body,
      request.headers,
      process.env,
    ));
  };
  
  export const del = (f:DeleteFunction) => (request:Request, response:Response) => {
    catchErrors<null>(response, () => f(
      request.params,
      undefined,
      request.headers,
      process.env,
    ));
  };
  