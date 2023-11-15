export interface ISimpleCryptWrapper {
    init(): any;
    decrypt(): Promise<any>;
}
