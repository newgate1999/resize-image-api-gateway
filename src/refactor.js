/**
 * Module dependencies.
 */

import {S3 as _S3} from 'aws-sdk';
import {generateS3Key} from './lib/utils';
import {isNullOrUndefined} from 'util';
import sharp from 'sharp';

const S3 = new _S3({
    signatureVersion: 'v4',
});

const IMAGE_SIZES = [128, 168, 264, 300, 1280, 1360, 1920, 2048, 2056, 2560, 3440, 3840, 'AUTO'];

/**
 * Export `imageprocess` module.
 */

export async function imageprocess(event, context, callback) {
    const queryParameters = event.queryStringParameters || {};
    const imageKey = decodeURIComponent(event.pathParameters.key);
    if (!process.env.BUCKET) {
        return callback(null, {
            statusCode: 404,
            body: 'Error: Set environment variables BUCKET.',
        });
    }
    const size = {
        width: isNullOrUndefined(queryParameters.width)
            ? null
            : parseInt(queryParameters.width),
        height: isNullOrUndefined(queryParameters.height)
            ? null
            : parseInt(queryParameters.height),
    };

    const params = {
        Bucket: process.env.BUCKET,
        Key: imageKey,
    }
    try {
        if (imageKey) {
            if (!size.width && !size.height) {
                const data = await S3.getObject(params).promise();
                const imgResize = await sharp(data.Body).png({quality: 95, progressive: true}).toBuffer();
                const response = {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000',
                    },
                    body: imgResize.toString('base64'),
                    isBase64Encoded: true,
                };
                return callback(null, response);
            } else {
                if (!size.width || !IMAGE_SIZES.includes(size.width)) {
                    return callback(null, {
                        statusCode: 403,
                        body: 'Error: Invalid image size.',
                    });
                } else {
                    const data = await S3.getObject(params).promise();
                    const imgResize = await sharp(data.Body)
                        .resize({width: size.width})
                        .png({quality: 95, progressive: true})
                        .toBuffer()
                    await S3.putObject({
                        Body: imgResize,
                        Bucket: process.env.BUCKET,
                        ContentType: 'image/jpeg',
                        CacheControl: 'max-age=31536000',
                        Key: generateS3Key(imageKey, size),
                        ACL: 'public-read',
                    }).promise();
                    const response = {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'image/jpeg',
                            'Cache-Control': 'public, max-age=31536000',
                        },
                        body: imgResize.toString('base64'),
                        isBase64Encoded: true,
                    };
                    console.log('response', response);
                    return callback(null, response);
                }
            }
        } else {
            return callback(null, {
                statusCode: 404,
                body: 'Error: Image not found.',
            });
        }
    } catch (e) {
        return callback(null, {
            statusCode: err.statusCode || 404,
            body: JSON.stringify(err),
        });
    }
}
