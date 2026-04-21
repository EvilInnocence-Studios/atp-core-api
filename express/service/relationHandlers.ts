import { pipeTo } from "ts-functional";
import { getBodyParam, getParam } from "../extractors";

export declare interface IRelationService<R> {
    get: (id: string) => Promise<R[]>;
    add: (relationId: string, otherId: string) => Promise<any>;
    remove: (relationId: string, otherId: string) => Promise<any>;
}

export const basicRelationHandlers = <R>(
    service: IRelationService<R>, 
    thisIdName: string, 
    otherIdName: string,
) => ({
    get: (args: any[]): Promise<R[]> => pipeTo(service.get, getParam(thisIdName))(args),
    add: (args: any[]): Promise<any> => pipeTo(service.add, getParam(thisIdName), getBodyParam<string>(otherIdName))(args),
    remove: (args: any[]): Promise<any> => pipeTo(service.remove, getParam(thisIdName), getParam(otherIdName))(args),
});
