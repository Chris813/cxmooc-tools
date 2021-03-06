import { MoocFactory, Mooc } from "../factory";
import { Hook, Context } from "@App/internal/utils/hook";
import { Application } from "@App/internal/application";
import { randNumber, get, createBtn, protocolPrompt } from "@App/internal/utils/utils";
import { TaskFactory, Task } from "./task";
import { CssBtn } from "./utils";

// 优化播放器
export class CxVideoOptimization implements Mooc {

    protected taskinfo: any;
    protected param: any;

    public Start(): void {
        //对播放器进行优化
        window.addEventListener("load", () => {
            (<any>Application.GlobalContext).Ext.isChaoxing = true;
        });
        document.addEventListener("readystatechange", () => { this.hook() });
        this.Api();
    }

    protected hook() {
        if (document.readyState != "interactive") {
            return;
        }
        Application.App.log.Debug("hook cx video");
        let dataHook = new Hook("decode", (<any>Application.GlobalContext).Ext);
        let self = this;
        dataHook.Middleware(function (next: Context, ...args: any) {
            let ret = next.apply(this, args);
            if (Application.App.config.super_mode && ret.danmaku == 1) {
                ret.danmaku = 0;
            }
            return ret;
        });
        window.frameElement.setAttribute("fastforward", "");
        window.frameElement.setAttribute("switchwindow", "");

        let paramHook = new Hook("params2VideoOpt", (<any>Application.GlobalContext).ans.VideoJs.prototype);
        paramHook.Middleware(function (next: Context, ...args: any) {
            self.param = args[0];
            let ret = next.apply(this, args);
            ret.plugins.timelineObjects.url = self.param.rootPath + "/richvideo/initdatawithviewer";
            let cdn = Application.App.config.video_cdn || localStorage["cdn"] || "公网1";
            for (let i = 0; i < ret.playlines.length; i++) {
                if (ret.playlines[i].label == cdn) {
                    let copy = ret.playlines[i];
                    (<Array<any>>ret.playlines).splice(i, 1);
                    (<Array<any>>ret.playlines).splice(0, 0, copy);
                }
            }
            localStorage["cdn"] = ret.playlines[0].label;
            return ret;
        });
        (<any>Application.GlobalContext).Ext.isSogou = false;

        let errorHook = new Hook("afterRender", (<any>Application.GlobalContext).ans.videojs.ErrorDisplay.prototype);
        errorHook.Middleware(function (next: Context, ...args: any) {
            let ret = next.apply(this, args);
            setTimeout(() => {
                let nowCdn = this.renderData.selectedIndex;
                let playlines = this.renderData.playlines;
                let cdn = Application.App.config.video_cdn || localStorage["cdn"] || "公网1";
                for (let i = 0; i < playlines.length; i++) {
                    if (i != nowCdn) {
                        if (cdn == "") {
                            localStorage["cdn"] = playlines[i].label;
                            return this.onSelected(i);
                        } else if (cdn == playlines[i].label) {
                            localStorage["cdn"] = playlines[i].label;
                            return this.onSelected(i);
                        }
                    }
                }
                let index = (nowCdn + 1) % playlines.length;
                localStorage["cdn"] = playlines[index].label;
                return this.onSelected(index);
            }, 2000);
            return ret;
        });
    }

    /**
     * 操作方法
     */
    protected Api() {
        (<any>Application.GlobalContext).sendTimePack = (time: number, callback: Function) => {
            if (time == NaN || time == undefined) {
                time = parseInt(this.param.duration);
            }
            let playTime = Math.round(time || (this.param.duration - randNumber(1, 2)));
            let enc = '[' + this.param.clazzId + '][' + this.param.userid + '][' +
                this.param.jobid + '][' + this.param.objectId + '][' +
                (playTime * 1000).toString() + '][d_yHJ!$pdA~5][' + (this.param.duration * 1000).toString() + '][0_' +
                this.param.duration + ']';
            enc = (<any>Application.GlobalContext).md5(enc);
            get(this.param.reportUrl + '/' + this.param.dtoken + '?clipTime=0_' + this.param.duration +
                '&otherInfo=' + this.param.otherInfo +
                '&userid=' + this.param.userid + '&rt=0.9&jobid=' + this.param.jobid +
                '&duration=' + this.param.duration + '&dtype=Video&objectId=' + this.param.objectId +
                '&clazzId=' + this.param.clazzId +
                '&view=pc&playingTime=' + playTime + '&isdrag=4&enc=' + enc, function (data: string) {
                    let isPassed = JSON.parse(data);
                    callback(isPassed.isPassed);
                });
        }
    }

}

export class VideoFactory implements TaskFactory {
    protected taskIframe: HTMLIFrameElement;
    protected task: Video;
    public CreateTask(context: any, taskinfo: any): Task {
        this.taskIframe = (<Window>context).document.querySelector(
            "iframe[jobid='" + taskinfo.jobid + "']"
        );
        if (this.taskIframe == undefined) {
            this.taskIframe = (<Window>context).document.querySelector(
                "iframe[mid='" + taskinfo.property.mid + "']"
            );
        }
        this.createActionBtn();
        this.task = new Video(this.taskIframe.contentWindow, taskinfo);
        this.task.muted = Application.App.config.video_mute;
        this.task.playbackRate = Application.App.config.video_multiple;
        return this.task;
    }

    protected createActionBtn() {
        let prev = <HTMLElement>this.taskIframe.previousElementSibling || <HTMLElement>this.taskIframe.parentElement;
        prev.style.textAlign = "center";
        prev.style.width = "100%";
        let startBtn = CssBtn(createBtn("开始挂机", "点击开始自动挂机播放视频", "cx-btn"));
        let pass = CssBtn(createBtn("秒过视频", "秒过视频会被后台检测到", "cx-btn"));
        let download = CssBtn(createBtn("下载视频", "我要下载视频好好学习", "cx-btn"));
        let downloadSubtitle = CssBtn(createBtn("下载字幕", "我要下载字幕一同食用"));
        pass.style.background = "#F57C00";
        download.style.background = "#999999";
        downloadSubtitle.style.background = "#638EE1";
        prev.prepend(startBtn, pass, download, downloadSubtitle);
        // 绑定事件
        startBtn.onclick = () => {
            this.task.Start();
        };
        pass.onclick = () => {
            if (!protocolPrompt("秒过视频会产生不良记录,是否继续?", "boom_no_prompt")) {
                return;
            }
            this.task.sendEndTimePack((isPassed: boolean) => {
                if (isPassed) {
                    alert('秒过成功,刷新后查看效果');
                } else {
                    alert('操作失败,错误');
                }
            });
        };
        download.onclick = () => {
            this.task.download();
        };
        downloadSubtitle.onclick = () => {
            this.task.downloadSubtitle();
        }

    }
}

export class Video extends Task {
    protected video: HTMLVideoElement;
    protected _playbackRate: number;
    protected _muted: boolean;
    protected afterPoint: number = 0;
    protected flash: boolean;
    public Init() {
        Application.App.log.Debug("播放器配置", this.taskinfo);
        let timer = this.context.setInterval(() => {
            try {
                let video = this.context.document.getElementById("video_html5_api");
                if (video == undefined) {
                    if (this.context.document.querySelector("#reader").innerHTML.indexOf("您没有安装flashplayer") >= 0) {
                        this.context.clearInterval(timer);
                        this.flash = true;
                        this.loadCallback && this.loadCallback();
                    }
                    return;
                }
                this.context.clearInterval(timer);
                this.video = video;
                this.initPlayer();
                this.video.addEventListener("ended", () => {
                    this.completeCallback && this.completeCallback();
                });
                this.video.addEventListener("pause", () => {
                    Application.App.config.auto && this.video.play();
                });
                this.loadCallback && this.loadCallback();
            } catch (error) {
            }
        }, 500);
    }

    public Start(): void {
        if (this.flash) {
            return this.completeCallback && this.completeCallback();
        }
        this.video.play();
    }

    protected initPlayer() {
        this.playbackRate = this._playbackRate; this.muted = this._muted;
    }

    /**
     * 秒过
     */
    public sendEndTimePack(callback: Function) {
        this.sendTimePack(this.video.duration, callback);
    }

    public sendTimePack(time: number, callback: Function) {
        this.context.sendTimePack(time, function (isPassed: any) {
            callback(isPassed);
        });
    }

    public download() {
        window.open(this.video.src);
    }

    public downloadSubtitle() {
        get('/richvideo/subtitle?mid=' + this.taskinfo.property.mid + '&_dc=' +
            Date.parse(new Date().toString()), function (data: any) {
                let json = JSON.parse(data);
                if (json.length <= 0) {
                    alert("没有字幕！");
                } else {
                    for (let i = 0; i < json.length; i++) {
                        let subtitleURL = json[i]['url'];
                        window.open(subtitleURL);
                    }
                }
            });
    }

    /**
     * 设置播放速度
     */
    public set playbackRate(speed: number) {
        this._playbackRate = speed;
        if (this.video) {
            this.video.playbackRate = speed;
        }
    }

    /**
     * 设置播放静音
     */
    public set muted(muted: boolean) {
        this._muted = muted;
        if (this.video) {
            this.video.muted = muted;
        }
    }
}
