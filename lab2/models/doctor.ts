/* eslint-disable @typescript-eslint/camelcase */
import { DataSource } from "../data-source/data-source";
import { Hospital } from "./hospital";

export class Doctor {

    constructor(
        public id: number,
        public hospitalId: number,
        public name: string,
        public surname: string,
        public specialization: string,
        public birthdate: Date
    ) {}

    public static async getById(entityId: number): Promise<[Doctor, Hospital]> {
        const query = `SELECT * FROM public."doctor" 
                        INNER JOIN public."hospital" ON public."doctor".hospital_id = public."hospital".id
                        WHERE public."doctor".id = $1`;
        const { rows } = await DataSource.getPool().query(query, [entityId]);
        if (!rows.length) {
            throw Error('No entity with such id found');
        }
        const { hospital_id, name, surname, specialization, birthdate, average_score, address } = rows[0];
        return [new Doctor(entityId, hospital_id, name, surname, specialization, birthdate), new Hospital(hospital_id, average_score, address)];
    }

    public static async getAll(): Promise<Map<Doctor, Hospital>> {
        const query = `SELECT public."doctor".*, public."hospital".average_score, public."hospital".address FROM public."doctor"
        INNER JOIN public."hospital" ON public."doctor".hospital_id = public."hospital".id`;
        const { rows } = await DataSource.getPool().query(query);
        const data = new Map()
        rows.forEach((row) => {
            const { id, hospital_id, name, surname, specialization, birthdate, average_score, address} = row;
            data.set(new Doctor(id, hospital_id, name, surname, specialization, birthdate), new Hospital(hospital_id, address, average_score));
        });
        return data;
    } 

    public static async create(hospitalId: number, name: string, surname: string, specialization: string, birthdate: Date): Promise<Doctor> {
        const query = `INSERT INTO public."doctor" (hospital_id, name, surname, specialization, birthdate) 
                        VALUES ($1, $2, $3, $4, $5) RETURNING id;`;
        const { rows } = await DataSource.getPool().query(query, [hospitalId, name, surname, specialization, birthdate]);
        const { id } = rows[0];
        return new Doctor(id, hospitalId, name, surname, specialization, birthdate);
    }

    public static async update(doctor: Doctor): Promise<void> {
        const query = `UPDATE public."doctor" 
                        SET hospital_id = $2, name = $3, surname = $4, specialization = $5, birthdate = $6
                        WHERE public."doctor".id = $1`;
        const { id, hospitalId, name, surname, specialization, birthdate } = doctor;
        const { rowCount } = await DataSource.getPool().query(query, [id, hospitalId, name, surname, specialization, birthdate]);
        if(!rowCount) {
            throw new Error('No entity with such id found');
        }
    }

    public static async delete(id: number): Promise<void> {
        const query = `DELETE FROM public."doctor" WHERE public."doctor".id = $1;`;
        const query2 = `DELETE FROM public."doctor_has_animal" WHERE "doctor_has_animal".doctor_id = $1;`
        await DataSource.getPool().query(query2, [id]);
        const { rowCount } = await DataSource.getPool().query(query, [id]);
        if(!rowCount) {
            throw new Error('No entity with such id found');
        }
    }

    public static async deleteAll(hospitalId: number): Promise<void> {
        const query = `DELETE FROM public."doctor" WHERE public."doctor".hospital_id = $1;`;
        const query2 = `DELETE FROM public."doctor_has_animal" WHERE "doctor_has_animal".doctor_id = $1;`
        const query3 = `SELECT * FROM public."doctor" WHERE public."doctor".hospital_id = $1;`
        const { rows } = await DataSource.getPool().query(query3, [hospitalId]);
        rows.forEach(async row => {
            await DataSource.getPool().query(query2, [row.id])
        })
        const { rowCount } = await DataSource.getPool().query(query, [hospitalId]);
        if(!rowCount) {
            throw new Error('No entities with such id found');
        }
    }

    public static async search3(name: string, surname: string, problem: string) {
        const query =  `SELECT public."animal".id, public."animal".nickname, public."animal".kind, public."animal".problem
                        FROM public."doctor"
                        INNER JOIN public."doctor_has_animal"
                        ON public."doctor_has_animal".doctor_id = public."doctor".id
                        INNER JOIN public."animal" 
                        ON public."doctor_has_animal".animal_id = public."animal".id
                        WHERE public."doctor".name = $1 AND
                              public."doctor".surname = $2 AND
                              public."animal".problem = $3`;
        const { rows, rowCount } = await DataSource.getPool().query(query, [name, surname, problem]);
        if(!rowCount) {
            throw new Error('No entities with such phrases found');
        }
        return rows;
    }

    public static async search2(text: string): Promise<any[]> {
        const query =  `SELECT *
                        FROM public."doctor"
                        INNER JOIN public."hospital" 
                        ON public."hospital".id = public."doctor".hospital_id
                        WHERE public."doctor".name LIKE '%${text}%' OR
                              public."doctor".surname LIKE '%${text}%' OR
                              public."doctor".specialization LIKE '%${text}%' OR
                              public."hospital".address LIKE '%${text}%'`;
        const { rows, rowCount } = await DataSource.getPool().query(query);
        if(!rowCount) {
            throw new Error('No entities with such phrases found');
        }
        return rows;                    
    }

    public static async search1(name: string, specialization: string, minimalAviaries: number, maximumAviaries: number): Promise<any[]> {
        const query =  `SELECT * FROM public."doctor" INNER JOIN public."hospital" ON public."hospital".id = public."doctor".hospital_id
                         WHERE (name = $1 AND specialization = $2 AND average_score BETWEEN $3 AND $4);`;
        const { rows, rowCount } = await DataSource.getPool().query(query, [name, specialization, minimalAviaries, maximumAviaries]);
        if(!rowCount) {
            throw new Error('No entities with such parameters found');
        }
        return rows;
    }

    public static async generate(amount: number): Promise<void> {
        const query = `INSERT INTO public."doctor" (hospital_id, name, surname, specialization, birthdate)
                        WITH expanded AS (
                            SELECT RANDOM(), seq, h.id AS hospital_id
                            FROM GENERATE_SERIES(1, $1) seq, public."hospital" h
                        ), shuffled AS (
                            SELECT e.*
                            FROM expanded e
                            INNER JOIN (
                                SELECT ei.seq, MIN(ei.random) FROM expanded ei GROUP BY ei.seq
                            ) em ON (e.seq = em.seq AND e.random = em.min)
                            ORDER BY e.seq
                        )
                        SELECT 
                            s.hospital_id,
                            LEFT(MD5(seq::text), 10),
                            LEFT(MD5(RANDOM()::text), 10),
                            LEFT(MD5(RANDOM()::text), 10),
                            TIMESTAMP '1970-01-01 00:00:01' + random() * (TIMESTAMP '1970-01-01 00:00:01' - TIMESTAMP '2038-01-19 03:14:07')
                        FROM shuffled s`
        console.time('doctors')
        await DataSource.getPool().query(query, [amount]);
        console.timeEnd('doctors')
    }



}