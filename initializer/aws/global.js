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
        [globalConstants.tagName]: globalConstants.tagValue
    }
}

module.exports = {
    ...constants_0,
    getTagsObject
}
