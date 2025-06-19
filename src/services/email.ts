import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets } from 'typeorm';
import { HelperService } from "./helper";
import { Users } from "../entities/users";
import underscore from 'underscore';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import FormData from 'form-data';
import { AffiliateBenefits } from '../entities/affiliate-benefits';
import { OperatorPurchases } from '../entities/operator-purchases';
import { Operators } from '../entities/operators';
import fs from 'fs';
import path from 'path';

export class EmailService {
    public helperService: HelperService;
    public mailgunApiDomain: string|undefined;
    public mailgunApiKey: string|undefined;
    public mailgunDomain: string|undefined;

    constructor() {
        this.helperService      = new HelperService();
        const config            = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8'));
        this.mailgunApiDomain   = config.MAILGUN_API_DOMAIN;
        this.mailgunApiKey      = config.MAILGUN_API_KEY;
        this.mailgunDomain      = config.MAILGUN_DOMAIN_NAME;
    }

    public async sendEmail(to: string[], cc: string, subject:string, message: string, attachment: any | undefined = undefined, filename: string | undefined = undefined, html: string | undefined = undefined): Promise<Boolean>{
        if(this.mailgunApiKey == undefined || this.mailgunDomain == undefined || this.mailgunApiDomain == undefined){
            console.log("Sending emails failed. Missing some env variables.");
            return false;
        }

        let buff = new Buffer('api:' + this.mailgunApiKey);

        let header = [
            ["Accept", "application/json"],
            ["Authorization", "Basic " + buff.toString('base64')]
        ];

        const formData = new FormData();
        formData.append('from', 'no-reply@' + this.mailgunDomain);
        formData.append('subject', subject);
        formData.append('text', message);
        if (html) {
            formData.append('html', html);
        }
        formData.append('o:tracking', 'false');
        formData.append('o:tracking-clicks', 'false');
        formData.append('o:tracking-opens', 'false');

        let uniqueTos   = [...new Set(to)];
        for (const to of uniqueTos) {
            if(to == undefined || to == null){
                continue;
            }

            formData.append('to', to);
        }

        console.log(this.mailgunApiDomain + this.mailgunDomain + '/messages');
        console.log(header);
        console.log(formData);

        try {
            const response = await this.helperService.rawPost<{}>(
                this.mailgunApiDomain + this.mailgunDomain + '/messages', 
                formData, 
                header
            );
    
            console.log(response);
        } catch (error) {
            console.log(error);

            return false;
        }

        console.log("Successfully sending emails");

        return true;
    }

    public async sendRegistrationOtp(user: Users): Promise<Boolean>{
        let message = "\
Halo " + user.username + "\n\n\
Sebelum mengubah apa pun, kamu perlu mengonfirmasi akun TagTag lebih dulu.\n\
Kamu perlu memasukkan kode OTP di bawah ini pada halaman konfirmasi.\n\n\
"+ [user.confirm_otp_token]  + "\n\n\
Rahasiakan kode ini pada siapa pun.\n\
Terima Kasih\n\
TagTag\n\
 ";

        await this.sendEmail([user.email], "", 'Kode Verifikasi TagTag', message);

        return true;
    }

    public async sendForgotPasswordOtp(user: Users, token:string): Promise<Boolean> {
        let url = `${process.env.BASE_API_URL}/auths/forgot-password?page=reset_password&t=${process.env.HOOK_TOKEN}&reset_password_token=${token}`;
        let message = "Hello!\n\n\
Halo, " + user.username + "!\n\n\
Sepertinya kamu ingin melakukan reset password TagTag kamu!\n\n\
Silahkan klik link dibawah ini untuk me-reset password TagTag kamu \n\n\
" + token + "\n\n\
Perhatian! Jika kamu tidak merasa melakukan permintaan atur ulang password, segera update keamanan akun kamu!\n\
Terima Kasih,\n\
Tim TagTag\n\
";

const html = `
<p>Halo, ${user.username}</p>
<p>Sepertinya kamu ingin melakukan reset password TagTag kamu!</p>
<p>Silahkan klik link dibawah ini untuk me-reset password TagTag kamu:</p><br>

<a href="${url}" disable-tracking=true>Reset Password TagTag</a><br><br>
<p>Perhatian! Jika kamu tidak merasa melakukan permintaan reset password, segera update keamanan akun kamu!</p>
<p>Terima Kasih, <br/> Tim TagTag</p>

`;
    
        await this.sendEmail([user.email], "", 'Permintaan atur ulang password.', message, undefined, undefined, html);

        return true;
    }

    public async sendChangeEmailRequestOtp(user: Users): Promise<Boolean>{
        let message = "\
Hello!\n\n\
We received a request to change your email.\n\
Below is the otp token to complete the changes.\n\n\
" + user.change_email_otp_token + "\n\n\n\
Please ignore if you did not request this change\
";

        await this.sendEmail([user.email], "", 'Email Change Code.', message);

        return true;
    }

    public async sendAffiliateUpgradeApproved(user: Users|undefined, previousBenefit: AffiliateBenefits|undefined, currentBenefit: AffiliateBenefits): Promise<boolean> {
        if (!user || !previousBenefit) return false;
        const url   = `${process.env.BASE_API_URL}/affiliates/upgrade/approved?prev=${previousBenefit.name}&current=${currentBenefit.name}&percent=${currentBenefit.affiliateBenefitTierings[0].value}`;
        let message = "\
Dear " + user.username + "\n\n\
Selamat! Pengajuan Update Level Afiliasi Kamu berhasil\n\n\
Level Sebelumnya: "+ [previousBenefit.name] + "\n\
Level Saat Ini: "+ [currentBenefit.name]  + " " + [currentBenefit.affiliateBenefitTierings[0].value*100] +"%\n\n\
Dapatkan lebih banyak benefit dengan terus ajak lebih banyak teman untuk bermain TagTag!\n\n\
Terima Kasih\n\
TagTag\n\
        ";

        await this.sendEmail([user.email], "", 'Pengajuan update level afiliasi diterima', message, undefined, undefined);

        return true;
    }

    public async sendAffiliateUpgradePending(user: Users|undefined, currentBenefit: AffiliateBenefits): Promise<boolean> {
        if (!user) return false;
        let message = "\
Halo " + user.username + "\n\n\
Saat ini permintaan untuk update level afiliasi kamu sedang dalam proses tinjauan tim TagTag\n\
Harap tunggu untuk pemberitahuan status selanjutnya.\n\n\
Level Saat Ini: "+ [currentBenefit.name]  + " " + [currentBenefit.affiliateBenefitTierings[0].value*100] +"% \n\n\
Tingkatkan terus status afiliasi kamu, supaya bisa mendapatkan benefit lebih lagi sesuai dengan ketentuan yang berlaku.\n\
Perlu diperhatikan jika performa kamu dalam 1 bulan tidak mencapai target level afiliasi kamu, maka sistem akan menurukan status level afiliasi kamu ke tingkat sebelumnya secara otomatis.\n\n\n\
Terima Kasih\n\
TagTag\n\
 ";

        await this.sendEmail([user.email], "", 'Pengajuan update level afiliasi sedang ditinjau', message, undefined, undefined);

        return true;
    }

    public async sendAffiliateUpgradeRejectedDuplicateSocial(user: Users|undefined, currentBenefit: AffiliateBenefits): Promise<boolean> {
        if (!user || !currentBenefit) return false;
        let message = "\
Dear " + user.username + "\n\n\
Pengajuan Update Level Afiliasi Kamu belum dapat kami terima.\n\n\
Level Saat Ini: "+ [currentBenefit.name]  + " " + [currentBenefit.affiliateBenefitTierings[0].value*100] +"% \n\n\
Pastikan Kamu memenuhi Syarat dan Ketentuan pengajuan Level Afiliasi.\n\n\
Terima Kasih\n\
TagTag\n\
        ";

        await this.sendEmail([user.email], "", 'Pengajuan update affiliasi ditolak', message, undefined, undefined);

        return true;
    }

    public async sendAffiliateUpgradeRejectedNotEnoughFolls(user: Users|undefined, currentBenefit: AffiliateBenefits): Promise<boolean> {
        if (!user || !currentBenefit) return false;
        let message = "\
Dear " + user.username + "\n\n\
Pengajuan Update Level Afiliasi Kamu belum dapat kami terima.\n\n\
Level Saat Ini: "+ [currentBenefit.name]  + " " + [currentBenefit.affiliateBenefitTierings[0].value*100] +"% \n\n\
Pastikan jumlah pengikut pada akun sosial media yang kamu ajukan sesuai dan memenuhi syarat ketentuan pengajuan level afiliasi.\n\n\
Terima Kasih\n\
TagTag\n\
        ";

        await this.sendEmail([user.email], "", 'Pegajuan update afiliasi di tolak', message, undefined, undefined);

        return true;
    }

    public async sendAffiliateUpgradeRejectedIncorrectLink(user: Users|undefined, currentBenefit: AffiliateBenefits): Promise<boolean> {
        if (!user || !currentBenefit) return false;
        let message = "\
Dear " + user.username + "\n\n\
Pengajuan Update Level Afiliasi Kamu belum dapat kami terima.\n\n\
Level Saat Ini: "+ [currentBenefit.name]  + " " + [currentBenefit.affiliateBenefitTierings[0].value*100] +"% \n\n\
Pastikan format penulisan Media Sosial kamu sesuai format.\n\n\
Youtube :\n\
contoh : www.youtube.com/Tagtag.GG\n\n\
Instagram :\n\
contoh : www.instagram.com/Tagtag.GG\n\n\
Facebook :\n\
contoh : www.facebook.com/Tagtag.GG\n\n\
Terima Kasih.\n\
Tim TagTag\n\
        ";

        await this.sendEmail([user.email], "", 'Pegajuan update afiliasi di tolak', message, undefined, undefined);

        return true;
    }

    public async sendPulsaFailed(user: Users|undefined, operator: Operators|undefined): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Transaksi pembelian Pulsa kamu senilai " + operator.denom + " belum berhasl kami proses.\n\n\
Dikarenakan  ID Pelanggan salah atau Nomor Kamu masukan salah. Pastikan bahwa data yang kamu masukan sesuai dan saldo Koin TagTag kamu cukup untuk melakukan transaksi ini. \n\n Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Failed', message, undefined, undefined);

        return true;
    }

    public async sendPulsaSuccess(user: Users|undefined, operator: Operators|undefined, operatorPurchase: OperatorPurchases): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Selamat! Transaksi pembelian Pulsa kamu senilai " + operator.denom + " telah berhasil dilakukan pada " + operatorPurchase.created_at +"\n\n\
Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Success', message, undefined, undefined);

        return true;
    }

    public async sendPDAMFailed(user: Users|undefined, operator: Operators|undefined): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Transaksi pembelian PDAM kamu senilai " + operator.denom + " belum berhasl kami proses.\n\n\
Dikarenakan  ID Pelanggan salah atau Nomor Kamu masukan salah. Pastikan bahwa data yang kamu masukan sesuai dan saldo Koin TagTag kamu cukup untuk melakukan transaksi ini. \n\n Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Failed', message, undefined, undefined);

        return true;
    }

    public async sendPDAMSuccess(user: Users|undefined, operator: Operators|undefined, operatorPurchase: OperatorPurchases): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Selamat! Transaksi pembelian PDAM kamu senilai " + operator.denom + " telah berhasil dilakukan pada " + operatorPurchase.created_at +"\n\n\
Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Success', message, undefined, undefined);

        return true;
    }

    public async sendPLNFailed(user: Users|undefined, operator: Operators|undefined, operatorPurchase: OperatorPurchases): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Transaksi pembelian Listrik PLN dengan nomor Pelanggan " + operatorPurchase.trx_id + " senilai "+ operator.denom +" belum berhasil kami proses\n\n\
Dikarenakan  ID Pelanggan salah atau Nomor Kamu masukan salah. Pastikan bahwa data yang kamu masukan sesuai dan saldo Koin TagTag kamu cukup untuk melakukan transaksi ini. \n\n Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Failed', message, undefined, undefined);

        return true;
    }

    public async sendPLNSuccess(user: Users|undefined, operator: Operators|undefined, operatorPurchase: OperatorPurchases): Promise<boolean> {
        if (!user || !operator) return false;
        let message = "\
Selamat! Transaksi pembelian Listrik PLN dengan nomor Pelanggan " + operatorPurchase.trx_id + " senilai "+ operator.denom +" telah berhasil dilakukan pada " + operatorPurchase.created_at +"\n\n\
Terima Kasih.\
        ";

        await this.sendEmail([user.email], "", 'Success', message, undefined, undefined);

        return true;
    }

    public async sendvVerificationKTPSuccess(user: Users|undefined): Promise<boolean> {
        if (!user) return false;
        let message = "\
Dear " + user.username + "\n\n\
Selamat! Verifikasi e-KYC kamu berhasil. \
Kamu sekarang sudah bisa melakukan Penarikan Koin maupun Komisi Afiliasi dalam aplikasi TagTag\n\
Ayo kumpulkan koin TagTag dan bagikan Link Afiliasi ke teman-temanmu untuk mendapat keuntungan lebih banyak!\n\n\n\
Terima Kasih.\n\
Tim TagTag\n\
        ";
    
        await this.sendEmail([user.email], "", 'Diterima', message, undefined, undefined);
    
        return true;
    }

    public async sendvVerificationKTPPending(user: Users|undefined): Promise<boolean> {
        if (!user) return false;
        let message = "\
Dear " + user.username + "\n\n\
Verifikasi e-KYC sedang dalam proses tinjauan tim TagTag.\n\
Harap tunggu untuk pemberitahuan status selanjutnya.\n\n\n\
Terima Kasih,\n\
Tim TagTag\n\
        ";
    
        await this.sendEmail([user.email], "", 'Sedang Ditinjau', message, undefined, undefined);
    
        return true;
    }

    public async sendvVerificationKTPRejected(user: Users|undefined): Promise<boolean> {
        if (!user) return false;
        let message = "\
Dear " + user.username + "\n\n\
Verifikasi KYC kamu belum dapat kami proses.\n\
Harap ulangi proses verifikasi kamu dengan mempertimbangkan syarat dan ketentuan dari TagTag.\n\n\n\
Terima Kasih,\n\
Tim TagTag\n\
        ";
    
        await this.sendEmail([user.email], "", 'Ditolak', message, undefined, undefined);
    
        return true;
    }

    public async sendTokenForVerifyPin(user: Users, token: string): Promise<Boolean>{
        let message = "\
Halo, " + user.username + "!\n\n\
Permintaan pembuatan PIN akun TagTag kamu sudah kami terima!\n\n\
Untuk step selanjutnya, kamu bisa memasukkan kode OTP dibawah untuk memverifikasi permintaanmu! \n\n\
" + token + "\n\n\
INGAT! Jangan bagikan kode OTP diatas kepada siapapun!\
";

        await this.sendEmail([user.email], "", 'Verifikasi Permintaan pembuatan PIN TagTag kamu', message);

        return true;
    }

    public async sendResetPIN(user: Users, token: string): Promise<Boolean> {
        const encoded   = Buffer.from(token).toString('base64');
        let url         = `${process.env.BASE_FE_URL}/reset_pin?token=${encoded}`;
        let message     = "\
Halo, " + user.username + "!\n\n\
Sepertinya kamu ingin melakukan reset PIN TagTag kamu!\n\n\
Silahkan klik link dibawah ini untuk me-reset PIN TagTag kamu \n\n\
" + token + "\n\n\
Perhatian! Jika kamu tidak merasa melakukan permintaan atur ulang Pin, segera update keamanan akun kamu!\n\
Terima Kasih,\n\
Tim TagTag\n\
";

const html = `
<p>Halo, ${user.username}</p>
<p>Sepertinya kamu ingin melakukan reset PIN TagTag kamu!</p>
<p>Silahkan klik link dibawah ini untuk me-reset PIN TagTag kamu:</p><br>

<a href="${url}" disable-tracking=true>Reset PIN TagTag</a><br><br>
<p>Perhatian! Jika kamu tidak merasa melakukan permintaan atur ulang Pin, segera update keamanan akun kamu!</p>
<p>Terima Kasih, <br/> Tim TagTag</p>

`;

        await this.sendEmail([user.email], "", 'Permintaan reset PIN TagTag', message, null, '', html);

        return true;
    }
}