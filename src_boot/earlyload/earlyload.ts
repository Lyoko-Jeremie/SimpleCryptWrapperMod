(async () => {
    // console.warn('SimpleCryptWrapper earlyload done', window.modUtils.getNowRunningModName());
    // window.modUtils.getLogger().warn(`SimpleCryptWrapper earlyload done ${window.modUtils.getNowRunningModName()}`);
    await window.modSimpleCryptWrapper.decrypt();
})();
