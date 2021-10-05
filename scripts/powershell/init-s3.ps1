aws s3api delete-bucket --bucket devextreme-ga-configs --region eu-central-1

# TODO: manage access
aws s3api create-bucket --cli-input-json file://s3-configurations/configs-bucket.json
aws s3api put-bucket-tagging --bucket devextreme-ga-configs --tagging file://s3-configurations/configs-bucket-tagging.json
