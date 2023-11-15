import {SimpleCryptWrapper} from "./SimpleCryptWrapper";

;(new SimpleCryptWrapper(window.modSC2DataManager, window.modUtils)).init();

// console.warn('SimpleCryptWrapper init done', window.modUtils.getNowRunningModName());
// window.modUtils.getLogger().warn(`SimpleCryptWrapper init done ${window.modUtils.getNowRunningModName()}`);
