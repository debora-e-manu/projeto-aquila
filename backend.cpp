#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <thread>
#include <mutex>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <algorithm>
#include <cstdlib>
#include <cstring>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
using socket_t = SOCKET;
#define CLOSESOCK closesocket
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
using socket_t = int;
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define CLOSESOCK close
#endif

std::mutex mtx;

struct Config {
    double capacidade=2000, altura=2.0, minimo=20, maximo=90, calibracao=1.0;
};
struct Status {
    double nivel=72, vazao=18, volume=1440;
    std::string sensor="ativo";
    std::string timestamp;
};
struct Registro {
    std::string timestamp;
    double nivel, volume, vazao;
    std::string sensor;
};
struct Alerta {
    std::string timestamp, titulo, mensagem;
    bool lida=false;
};

Config config;
Status status;
std::vector<Registro> historico;
std::vector<Alerta> alertas;

std::string nowISO(){
    std::time_t t=std::time(nullptr);
    std::tm tmv{};
#ifdef _WIN32
    localtime_s(&tmv,&t);
#else
    localtime_r(&t,&tmv);
#endif
    std::ostringstream o;
    o<<std::put_time(&tmv,"%Y-%m-%dT%H:%M:%S");
    return o.str();
}

std::string jsonEscape(const std::string& s){
    std::string r;
    for(char c:s){ if(c=='"') r+="\\\""; else if(c=='\\') r+="\\\\"; else r+=c; }
    return r;
}

std::string num(double x){ std::ostringstream o; o<<std::fixed<<std::setprecision(2)<<x; return o.str(); }

std::string jsonStatus(){
    std::lock_guard<std::mutex> lock(mtx);
    return "{\"nivel\":"+num(status.nivel)+",\"volume\":"+num(status.volume)+",\"vazao\":"+num(status.vazao)+
           ",\"bomba\":"+(status.bomba?"true":"false")+",\"sensor\":\""+status.sensor+"\",\"timestamp\":\""+status.timestamp+"\"}";
}

std::string jsonHistory(){
    std::lock_guard<std::mutex> lock(mtx);
    std::ostringstream o; o<<"[";
    for(size_t i=0;i<historico.size();++i){
        if(i)o<<",";
        const auto&r=historico[i];
        o<<"{\"timestamp\":\""<<r.timestamp<<"\",\"nivel\":"<<num(r.nivel)<<",\"volume\":"<<num(r.volume)
         <<",\"vazao\":"<<num(r.vazao)<<",\"sensor\":\""<<r.sensor<<"\"}";
    }
    o<<"]"; return o.str();
}
std::string jsonAlerts(){
    std::lock_guard<std::mutex> lock(mtx);
    std::ostringstream o; o<<"[";
    for(size_t i=0;i<alertas.size();++i){
        if(i)o<<",";
        auto&a=alertas[i];
        o<<"{\"timestamp\":\""<<a.timestamp<<"\",\"titulo\":\""<<jsonEscape(a.titulo)<<"\",\"mensagem\":\""<<jsonEscape(a.mensagem)<<"\",\"lida\":"<<(a.lida?"true":"false")<<"}";
    }
    o<<"]"; return o.str();
}
std::string jsonConfig(){
    std::lock_guard<std::mutex> lock(mtx);
    return "{\"capacidade\":"+num(config.capacidade)+",\"altura\":"+num(config.altura)+",\"minimo\":"+num(config.minimo)+",\"maximo\":"+num(config.maximo)+",\"calibracao\":"+num(config.calibracao)+"}";
}

double getNumber(const std::string& b,const std::string& key,double fallback){
    auto p=b.find("\""+key+"\"");
    if(p==std::string::npos)return fallback;
    p=b.find(':',p); if(p==std::string::npos)return fallback;
    try{return std::stod(b.substr(p+1));}catch(...){return fallback;}
}
bool getBool(const std::string& b,const std::string& key,bool fallback){
    auto p=b.find("\""+key+"\"");
    if(p==std::string::npos)return fallback;
    p=b.find(':',p); if(p==std::string::npos)return fallback;
    return b.find("true",p+1)==p+1 || b.find("true",p+1)<b.find_first_of(",}",p+1);
}
std::string getString(const std::string& b,const std::string& key,const std::string& fallback){
    auto p=b.find("\""+key+"\"");
    if(p==std::string::npos)return fallback;
    p=b.find('"',b.find(':',p)+1); if(p==std::string::npos)return fallback;
    auto e=b.find('"',p+1); if(e==std::string::npos)return fallback;
    return b.substr(p+1,e-p-1);
}

void addAlert(const std::string& title,const std::string& msg){
    alertas.push_back({nowISO(),title,msg,false});
    if(alertas.size()>50)alertas.erase(alertas.begin());
}

void addHistory(){
    historico.push_back({status.timestamp,status.nivel,status.volume,status.vazao,status.bomba,status.sensor});
    if(historico.size()>200)historico.erase(historico.begin());
}

void simulate(){
    while(true){
        std::this_thread::sleep_for(std::chrono::seconds(5));
        std::lock_guard<std::mutex> lock(mtx);
        if(status.sensor=="ativo"){
            double delta=-0.2 + ((std::rand()%100)/100.0-0.5)*0.8;
            status.nivel=std::max(0.0,std::min(100.0,status.nivel+delta));
            status.vazao=18.0+(std::rand()%80)/10.0;
            status.volume=config.capacidade*status.nivel/100.0;
            status.timestamp=nowISO();
            if(status.nivel<config.minimo){
                bool exists=false; for(auto&a:alertas)if(a.titulo=="Nível baixo"&&!a.lida)exists=true;
                if(!exists)addAlert("Nível baixo","O reservatório está abaixo do limite configurado.");
            }
            if(status.nivel>config.maximo){
                bool exists=false; for(auto&a:alertas)if(a.titulo=="Nível alto"&&!a.lida)exists=true;
                if(!exists)addAlert("Nível alto","O reservatório está acima do limite configurado.");
            }
            addHistory();
        }
    }
}

std::string mime(const std::string& path){
    if(path.ends_with(".html"))return "text/html; charset=utf-8";
    if(path.ends_with(".css"))return "text/css; charset=utf-8";
    if(path.ends_with(".js"))return "application/javascript; charset=utf-8";
    if(path.ends_with(".json"))return "application/json; charset=utf-8";
    return "text/plain; charset=utf-8";
}

std::string staticFile(const std::string& path){
    std::string p=path;
    if(p=="/")p="/index.html";
    if(p.find("..")!=std::string::npos)return "";
    std::ifstream f("."+p,std::ios::binary);
    if(!f)return "";
    std::ostringstream ss;ss<<f.rdbuf();return ss.str();
}

void sendResponse(socket_t s,int code,const std::string& type,const std::string& body){
    std::string msg="HTTP/1.1 "+std::to_string(code)+" "+(code==200?"OK":"Not Found")+"\r\n";
    msg+="Content-Type: "+type+"\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\nContent-Length: "+std::to_string(body.size())+"\r\n\r\n"+body;
    send(s,msg.c_str(),(int)msg.size(),0);
}

void handle(socket_t s){
    char buf[65536]; int n=recv(s,buf,sizeof(buf)-1,0);
    if(n<=0){CLOSESOCK(s);return;} buf[n]='\0';
    std::string req(buf,n);
    std::istringstream first(req);
    std::string method,path,version; first>>method>>path>>version;

    if(method=="OPTIONS"){sendResponse(s,200,"text/plain","");CLOSESOCK(s);return;}

    size_t bodyPos=req.find("\r\n\r\n");
    std::string body=bodyPos==std::string::npos?"":req.substr(bodyPos+4);

    if(path=="/api/health" && method=="GET") sendResponse(s,200,"application/json","{\"status\":\"online\",\"service\":\"Aquila API\"}");
    else if(path=="/api/status" && method=="GET") sendResponse(s,200,"application/json",jsonStatus());
    else if(path=="/api/historico" && method=="GET") sendResponse(s,200,"application/json",jsonHistory());
    else if(path=="/api/alertas" && method=="GET") sendResponse(s,200,"application/json",jsonAlerts());
    else if(path=="/api/alertas" && method=="POST"){
        if(body.find("ler_todos")!=std::string::npos){std::lock_guard<std::mutex>l(mtx);for(auto&a:alertas)a.lida=true;}
        sendResponse(s,200,"application/json",jsonAlerts());
    }
    else if(path=="/api/configuracoes" && method=="GET") sendResponse(s,200,"application/json",jsonConfig());
    else if(path=="/api/configuracoes" && method=="POST"){
        std::lock_guard<std::mutex> l(mtx);
        config.capacidade=getNumber(body,"capacidade",config.capacidade);
        config.altura=getNumber(body,"altura",config.altura);
        config.minimo=getNumber(body,"minimo",config.minimo);
        config.maximo=getNumber(body,"maximo",config.maximo);
        config.calibracao=getNumber(body,"calibracao",config.calibracao);
        status.volume=config.capacidade*status.nivel/100.0;
        sendResponse(s,200,"application/json",jsonConfig());
    }
    else if(path=="/api/calibracao" && method=="POST"){
        std::lock_guard<std::mutex> l(mtx);
        config.calibracao=getNumber(body,"valor",config.calibracao);
        sendResponse(s,200,"application/json",jsonConfig());
    }
    else if(path=="/api/sensor" && method=="POST"){
        std::lock_guard<std::mutex> l(mtx);
        status.nivel=getNumber(body,"nivel",status.nivel);
        status.vazao=getNumber(body,"vazao",status.vazao);
        status.sensor=getString(body,"sensor",status.sensor);
        status.volume=config.capacidade*status.nivel/100.0;
        status.timestamp=nowISO();
        addHistory();
        sendResponse(s,200,"application/json",jsonStatus());
    }
    else{
        std::string file=staticFile(path);
        if(file.empty())sendResponse(s,404,"text/plain","Arquivo/rota não encontrado.");
        else sendResponse(s,200,mime(path),file);
    }
    CLOSESOCK(s);
}

int main(){
    std::srand((unsigned)std::time(nullptr));
    status.timestamp=nowISO();
    {
        std::lock_guard<std::mutex>l(mtx);
        for(int i=23;i>=0;--i){
            Status old=status;
            old.nivel=68+i*0.2+((std::rand()%100)/100.0-0.5)*3;
            old.nivel=std::max(0.0,std::min(100.0,old.nivel));
            old.volume=config.capacidade*old.nivel/100.0;
            old.vazao=10+(std::rand()%100)/10.0;
            old.timestamp=nowISO();
            historico.push_back({old.timestamp,old.nivel,old.volume,old.vazao,"ativo"});
        }
    }
    std::thread(simulate).detach();

#ifdef _WIN32
    WSADATA wsa; WSAStartup(MAKEWORD(2,2),&wsa);
#endif
    socket_t server=socket(AF_INET,SOCK_STREAM,0);
    if(server==INVALID_SOCKET){std::cerr<<"Erro ao criar socket.\n";return 1;}
    int opt=1; setsockopt(server,SOL_SOCKET,SO_REUSEADDR,(char*)&opt,sizeof(opt));
    sockaddr_in addr{};addr.sin_family=AF_INET;addr.sin_addr.s_addr=INADDR_ANY;addr.sin_port=htons(8080);
    if(bind(server,(sockaddr*)&addr,sizeof(addr))==SOCKET_ERROR){std::cerr<<"Porta 8080 indisponível.\n";return 1;}
    listen(server,10);
    std::cout<<"=====================================\n";
    std::cout<<" AQUILA API - servidor iniciado\n";
    std::cout<<" http://localhost:8080\n";
    std::cout<<"=====================================\n";
    while(true){
        socket_t client=accept(server,nullptr,nullptr);
        if(client!=INVALID_SOCKET)std::thread(handle,client).detach();
    }
    CLOSESOCK(server);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
