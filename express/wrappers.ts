import { Request, RequestHandler, Response } from "express";
import { catchErrors } from "./errors";
import { DeleteFunction, GetFunction, PatchFunction, PostFunction, PutFunction } from "./types";
import { parseNestedQuery } from "./util";

const getIp = (request: Request): string => {
  const forwardedFor = request.headers['x-forwarded-for'] as string;
  return forwardedFor ? forwardedFor.split(',')[0].trim() : request.ip || "";
}

export const get = <T>(f: GetFunction<T>): RequestHandler => (request: Request, response: Response) => {
  console.log("GET request", request.method, request.url, request.body);
  const query = request.query;
  const ip = getIp(request);
  catchErrors<T>(response, () => f(
    request.params,
    !!query ? parseNestedQuery(query) : null,
    { ...request.headers, ip },
    process.env,
  ));
};

export const post = <Result, Body = Partial<Result>>(f: PostFunction<Result, Body>): RequestHandler => (request: Request, response: Response) => {
  console.log("POST request", request.method, request.url, request.body);
  const ip = getIp(request);
  catchErrors<Result>(response, () => f(
    request.params,
    request.body,
    { ...request.headers, ip },
    process.env,
  ));
};

export const put = <T>(f: PutFunction<T>): RequestHandler => (request: Request, response: Response) => {
  console.log("PUT request", request.method, request.url, request.body);
  const ip = getIp(request);
  catchErrors<T>(response, () => f(
    request.params,
    request.body,
    { ...request.headers, ip },
    process.env,
  ));
};

export const patch = <Result, Body = Result>(f: PatchFunction<Result, Body>) => (request: Request, response: Response) => {
  console.log("PATCH request", request.method, request.url, request.body);
  const ip = getIp(request);
  catchErrors<Result>(response, () => f(
    request.params,
    request.body,
    { ...request.headers, ip },
    process.env,
  ));
};

export const del = (f: DeleteFunction) => (request: Request, response: Response) => {
  console.log("DEL request", request.method, request.url, request.body);
  const ip = getIp(request);
  catchErrors<null>(response, () => f(
    request.params,
    undefined,
    { ...request.headers, ip },
    process.env,
  ));
};

export const upload = (f: PostFunction<any, any>) => (request: Request, response: Response) => {
  console.log("UPLOAD request");
  console.log("Got file to upload");
  console.log(request.method, request.url);
  console.log("Calling upload function");
  const ip = getIp(request);
  catchErrors<any>(response, () => f(
    request.params,
    { files: request.files, body: request.body }, // Pass files and body separately
    { ...request.headers, ip },
    process.env,
  ));
};