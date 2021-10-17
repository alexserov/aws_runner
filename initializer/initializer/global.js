const constants = {
    tagName: '',
    tagValue: '',
    region: '',
};
const getTagsObject = (name) => {
    const namepart = name ? { Name: name } : {};
    return {
        ...namepart,
        [constants.tagName]: constants.tagValue,
    };
};
const getTagsArray = (name) => {
    const namepart = name ? [{ Key: 'Name', Value: name }] : [];
    return [
        ...namepart,
        { Key: constants.tagName, Value: constants.tagValue },
    ];
};

constants.getTagsObject = getTagsObject;
constants.getTagsArray = getTagsArray;

module.exports = constants;
