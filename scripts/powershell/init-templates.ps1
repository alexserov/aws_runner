$launchTemplateResult = aws ec2 create-launch-template `
    --launch-template-name devextreme-ga-launch-template `
    --version-description 1 `
    --launch-template-data "{
        'ImageId': 
    }".Replace("'", "\""");

