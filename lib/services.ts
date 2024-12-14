import { uacServices } from "./services/uac";
import { IMethods } from "./types.d";

export const apiServices = (methods:IMethods) => ({
    ...uacServices(methods),
});