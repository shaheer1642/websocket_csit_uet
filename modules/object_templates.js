
module.exports = {
    template_applications_forwarded_to:  {
        "sender_id": "user_id",
        "receiver_id": "user_id",
        "sender_remarks": "string",
        "receiver_remarks": "string",
        "status": "completed || under_review || rejected",
        "forward_timestamp": "timestamp",
        "completion_timestamp": "timestamp",
    },
    template_applications_detail_structure_object: {
        "field_name": "", 
        "field_type": "", 
        "field_value": "", 
        "placeholder": "",
        "disabled": false, 
        "required": true, 
        "multi_line": false,
    },
}