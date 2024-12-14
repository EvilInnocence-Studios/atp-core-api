import request from "superagent";

export const getResults = <T>(response:request.Response):T => response.body as T;