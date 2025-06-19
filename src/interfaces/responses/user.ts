export interface UserPermission {
    sf_access: boolean
}

export interface UserWssLinks {
    wss_link: string,
    weight  : number
}

export interface SipInformationResponse {
    name                                    : string,
    wss_url                                 : string,
    sip_url                                 : string,
    protocol                                : string,
    wrap_up_duration                        : number,
    max_hold_per_call                       : number,
    max_hold_duration                       : number,
    is_auto_answered                        : boolean,
    is_disposition_disabled                 : boolean,
    sip_registration_expiry                 : number,
    is_stun_disabled                        : boolean,
    enable_uppersrv                         : boolean,
    sf_auto_inbound_case_creation           : boolean,
    sf_auto_outbound_case_creation          : boolean,
    permissions                             : UserPermission,
    wss_links                               : UserWssLinks[],
    campaign_id                             : string,
    last_login_at                           : string,
    auto_post_call_survey                   : boolean,
    line_of_business_id                     : number,
    company_id                              : number,
    is_agent_to_agent_call_transfer_enabled : boolean
};