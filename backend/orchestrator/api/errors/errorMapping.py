def invalidRequestError(details):
    return {
        "errorCode": "INVALID_REQUEST",
        "message": "Request validation failed",
        "details": details,
    }


def runNotFoundError(runId):
    return {
        "errorCode": "RUN_NOT_FOUND",
        "message": "Run not found",
        "details": {"runId": runId},
    }


def sourceNotFoundError(sourceId):
    return {
        "errorCode": "SOURCE_NOT_FOUND",
        "message": "Source not found",
        "details": {"sourceId": sourceId},
    }
