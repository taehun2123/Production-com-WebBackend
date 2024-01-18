import { Router, Request, Response } from "express"
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import User from "../models/users.model";
import { QueryError, ResultSetHeader, RowDataPacket } from "mysql2";

const jwtSecret = 'sung_dong'

const authController = {
    login : async (req : Request, res : Response) => {
        const loadUser = req.body;

        try {
        User.login(loadUser, (err : QueryError | { kind: string; } | null, data: {users_id: number, userId: any, userPassword: any, userType_id: number} | null) => {
            if (data !== null) {
                const token = jwt.sign({
                userType_id: data.userType_id,
                users_id: data.users_id
                }, jwtSecret, { expiresIn: '1h' });
        
                req.user = data;
                res.cookie('jwt_token', token, {secure: true, sameSite: "none"});
                res.json({ success: true, message: "로그인 되었습니다.", token });
                // 토큰 정보를 데이터베이스에 저장
                // User.token([data.users_id, token, new Date(Date.now() + 60 * 60 * 1000)], (err: QueryError | { kind: string; } | null) => {
                // });
            } else {
                res.json({ success: false, message: "아이디 및 비밀번호를 확인해주세요!" });
            }
        });
        } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "서버 오류 발생" });
        }
    },
    logout: async (req: Request, res: Response) => {
        res.clearCookie('jwt_token', {secure: true, sameSite: 'none'});
        res.send({ success: true, message: "로그아웃 되었습니다."});
    },

    register : async (req : Request, res : Response) => {
        if(!req.body){
            res.status(400).send({
                message: "내용을 채워주세요!"
            });
        };
        const commonUserId = uuidv4();

        const newUser = {
            users1: {
                users_id: commonUserId,
                userType_id: req.body.userType_id,
                userId: req.body.userId,
                userPassword: req.body.userPassword,
            },
            users2: {
                users_id: commonUserId,
                userType_id: req.body.userType_id,
                email: req.body.email,
                emailService: req.body.emailService,
                name: req.body.name,
                tel: req.body.tel,
                smsService: req.body.smsService,
                hasCMS: req.body.hasCMS,
            },
            users3: {
                users_id: commonUserId,
                userType_id: req.body.userType_id,
                cor_ceoName: req.body.cor_ceoName,
                cor_corName: req.body.cor_corName,
                cor_sector: req.body.cor_sector,
                cor_category: req.body.cor_category,
                cor_num: req.body.cor_num,
                cor_fax: req.body.cor_fax,
                cor_tel: req.body.cor_tel
            },
            users4: {
                users_id: commonUserId,
                userType_id: req.body.userType_id,
                zonecode: req.body.zonecode,
                roadAddress: req.body.roadAddress,
                bname: req.body.bname,
                buildingName: req.body.buildingName,
                jibunAddress: req.body.jibunAddress,
                addressDetail: req.body.addressDetail
            },
        };

        // 데이터베이스에 저장
        User.create(newUser, (err: { message: any; }) =>{
            if(err)
                return res.status(500).send({ message: err.message || "유저 정보를 갱신하는 중 서버 오류가 발생했습니다." });
            else
                return res.send({ message: '성공적으로 회원가입이 완료되었습니다.', success: true });
        })
        return res.status(200).json({ msg: "가입에 성공하였습니다!" });
    },
    info : async (req : Request, res : Response) => {   
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({msg : "token null"})
        }

        jwt.verify(token, jwtSecret, (err: any, user: any) => {
            if (err) {
                return res.status(403).json({msg : "Invalid Token"})
            }
            else {
                User.findAllUserInfo(user, (err: QueryError | string | null, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
                if (err) {
                    return res.status(500).send({ message: err });
                } else {
                    return res.status(200).json({ message: '인증이 완료되었습니다.', success: true, data });
                }
                });
            }
        })
    },
    user : async (req : Request, res : Response) => {        
        const token = req.header('Authorization');
        if (!token) {
            return res.status(401).json({msg : "token null"})
        }

        jwt.verify(token, jwtSecret, (err, user) => {
            if (err) {
                return res.status(403).json({msg : "Invalid Token"})
            }
            return res.status(200).json({user : user})
        })
    },
    findId : async (req : Request, res : Response) => {    
        if(!req.body){
            res.status(400).send({
                message: "내용을 채워주세요!"
            });
        };
        const user = {
            cor_ceoName: req.body.cor_ceoName,
            cor_num: req.body.cor_num
        }
        User.findUserID(user, (err: QueryError | string | null, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
            if (err) {
                return res.status(500).send({ message: err });
            } else {
                return res.status(200).json({ message: '아이디를 찾았습니다.', success: true, data });
            }
        });
    },
    findPw : async (req : Request, res : Response) => {    
        if(!req.body){
            res.status(400).send({
                message: "내용을 채워주세요!"
            });
        };
        const user = {
            userId: req.body.userId,
            cor_num: req.body.cor_num
        }
        User.findUserPw(user, (err: QueryError | string | null, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
            if (err) {
                return res.status(500).send({ message: err });
            } else {
                return res.status(200).json({ message: '비밀번호를 찾았습니다.', success: true, data });
            }
        });
    }
}

export default authController