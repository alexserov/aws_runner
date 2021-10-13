const constants_0 = {
    tagName: 'dx-info',
    tagValue: 'devextreme-ga',
    region: 'eu-central-1',
    getTagsObject: (name) => { }
}
const getTagsObject = (name) => {
    const namepart = name ? { Name: name } : {};
    return {
        ...namepart,
        [constants_0.tagName]: constants_0.tagValue
    }
}
const getTagsArray = (name) => {
    const namepart = name ? [{ Key: 'Name', Value: name }] : [];
    return [
        ...namepart,
        { Key: constants_0.tagName, Value: constants_0.tagValue }
    ];
}

module.exports = {
    ...constants_0,
    getTagsObject,
    getTagsArray
}
