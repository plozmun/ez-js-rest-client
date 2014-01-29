/* global define */
define(["structures/CAPIError"], function (CAPIError) {
    "use strict";

    /**
     * Creates an instance of SessionAuthAgent object
     * * Auth agent handles low level implementation of authorization workflow
     *
     * @class SessionAuthAgent
     * @constructor
     * @param credentials {Object} object literal containg credentials for the REST service access
     * @param credentials.login {String} user login
     * @param credentials.password {String} user password
     */
    var SessionAuthAgent = function (credentials) {
        // is initiated inside CAPI constructor by using setCAPI() method
        this._CAPI = null;

        this._login = credentials.login;
        this._password = credentials.password;

        //TODO: implement storage selection mechanism
        this.sessionName = sessionStorage.getItem('ezpRestClient.sessionName');
        this.sessionId = sessionStorage.getItem('ezpRestClient.sessionId');
        this.csrfToken = sessionStorage.getItem('ezpRestClient.csrfToken');
    };

    /**
     * Called every time a new request cycle is started,
     * to ensure those requests are correctly authenticated.
     *
     * A cycle may contain one or more queued up requests
     *
     * @method ensureAuthentication
     * @param done {Function} Callback function, which is to be called by the implementation to signal the authentication has been completed.
     */
    SessionAuthAgent.prototype.ensureAuthentication = function (done) {
        if (this.sessionId !== null) {
            done(false, true);
            return;
        }

        var that = this,
            userService = this._CAPI.getUserService(),
            sessionCreateStruct = userService.newSessionCreateStruct(
                this._login,
                this._password
            );

        userService.createSession(
            sessionCreateStruct,
            function (error, sessionResponse) {
                if (error) {
                    done(
                        new CAPIError(
                            "Failed to create new session.",
                            {sessionCreateStruct: sessionCreateStruct}
                        ),
                        false
                    );
                    return;
                }

                var session = JSON.parse(sessionResponse.body).Session;

                that.sessionName = session.name;
                that.sessionId = session._href;
                that.csrfToken = session.csrfToken;

                sessionStorage.setItem('ezpRestClient.sessionName', that.sessionName);
                sessionStorage.setItem('ezpRestClient.sessionId', that.sessionId);
                sessionStorage.setItem('ezpRestClient.csrfToken', that.csrfToken);

                done(false, true);
            }
        );
    };

    /**
     * Hook to allow the modification of any request, for authentication purposes, before
     * sending it out to the backend
     *
     * @method authenticateRequest
     * @param request {Request}
     * @param done {function}
     */
    SessionAuthAgent.prototype.authenticateRequest = function (request, done) {
        if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS" && request.method !== "TRACE" ) {
            request.headers["X-CSRF-Token"] = this.csrfToken;
        }

        done(false, request);
    };

    /**
     * Log out workflow
     * Kills currently active session and resets sessionStorage params (sessionId, CSRFToken)
     *
     * @method logOut
     * @param done {function}
     */
    SessionAuthAgent.prototype.logOut = function (done) {
        var userService = this._CAPI.getUserService(),
            that = this;

        userService.deleteSession(
            this.sessionId,
            function (error, response) {
                if (error) {
                    done(true, false);
                    return;
                }

                that.sessionName = null;
                that.sessionId = null;
                that.csrfToken = null;

                sessionStorage.removeItem('ezpRestClient.sessionName');
                sessionStorage.removeItem('ezpRestClient.sessionId');
                sessionStorage.removeItem('ezpRestClient.csrfToken');

                done(false, true);
            }
        );
    };

    /**
     * Set the instance of the CAPI to be used by the agent
     *
     * @method setCAPI
     * @param CAPI {CAPI} current instance of the CAPI object
     */
    SessionAuthAgent.prototype.setCAPI = function (CAPI) {
        this._CAPI = CAPI;
    };

    return SessionAuthAgent;

});