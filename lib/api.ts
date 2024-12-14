import { config } from "../config";
import { apiMethods } from "./common/api/methods";
import {apiServices} from "./common/api/services";
export const api = apiMethods(config.api);

export const services = apiServices(api);